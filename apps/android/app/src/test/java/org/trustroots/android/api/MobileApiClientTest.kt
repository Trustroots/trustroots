package org.trustroots.android.api

import java.net.ServerSocket
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class MobileApiClientTest {
    @Test
    fun parsesMemberSearchAndProfileFields() {
        val members = parseMembers(JSONArray("""[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","locationLiving":"Leeds","languages":["en"],"member":[{"tribe":{"_id":"circle-one","slug":"travellers","label":"Travellers","image":true,"count":12}}]}]"""))
        assertEquals("member-one", members.single().id)
        assertEquals("Leeds", members.single().location)
        assertEquals(listOf("en"), members.single().languages)
        assertEquals("Travellers", members.single().circles.single().label)
    }

    @Test
    fun selectsOtherConversationMemberAndParsesMessages() {
        val threads = parseThreads(JSONArray("""[{"_id":"thread-one","message":{"excerpt":"Hello"},"read":false,"userFrom":{"_id":"mine","username":"quiet-fox"},"userTo":{"_id":"other","username":"steady-heron","displayName":"Steady Heron"}}]"""), "quiet-fox")
        assertEquals("other", threads.single().otherMember.id)
        assertEquals("Steady Heron", threads.single().otherMember.label)
        assertFalse(threads.single().read)
        val messages = parseMessages(JSONArray("""[{"_id":"message-one","content":"Hello","userFrom":{"username":"quiet-fox"}}]"""))
        assertEquals("Hello", messages.single().content)
    }

    @Test
    fun parsesMapCoordinatesAndHostDetails() {
        val offers = parseMapOffers(JSONObject("""{"features":[{"properties":{"id":"offer-one","type":"host","status":"maybe"},"geometry":{"coordinates":[-9.1,38.7]}},{"properties":{"id":"invalid"},"geometry":{"coordinates":[200,38.7]}}]}"""))
        assertEquals(1, offers.size)
        assertEquals(38.7, offers.single().latitude, 0.0001)
        assertEquals("maybe", offers.single().status)
        val host = parseHostOffer(JSONObject("""{"_id":"offer-one","status":"yes","description":"A spare room","maxGuests":2,"user":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}"""))
        assertEquals("Quiet Fox", host.user.label)
        assertEquals(2, host.maxGuests)
    }

    @Test
    fun parsesCircleList() {
        val circles = parseCircles(JSONArray("""[{"_id":"circle-one","slug":"travellers","label":"Travellers","count":12,"description":"Meet people","image":true,"color":"#123456"}]"""))
        assertEquals("Travellers", circles.single().label)
        assertEquals(12, circles.single().count)
        assertTrue(circles.single().image)
        assertEquals("#123456", circles.single().color)
    }

    @Test
    fun parsesHostingInformation() {
        val offer = parseAccommodationOffer(
            JSONObject(
                """{"_id":"offer-host","status":"maybe","description":"<p>A sofa</p>","noOfferDescription":"Away","maxGuests":1,"showOnlyInMyCircles":true,"location":[51.5,-0.12]}""",
            ),
        )
        assertEquals("offer-host", offer.id)
        assertEquals("maybe", offer.status)
        assertEquals(1, offer.maxGuests)
        assertTrue(offer.showOnlyInMyCircles)
        assertEquals(51.5, offer.latitude!!, 0.0001)
        assertEquals(-0.12, offer.longitude!!, 0.0001)
    }

    @Test
    fun parsesAccountDetails() {
        val details = parseAccountDetails(
            JSONObject(
                """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet@example.test","emailTemporary":"pending@example.test","newsletter":true}""",
            ),
        )
        assertEquals("quiet-fox", details.username)
        assertEquals("quiet@example.test", details.email)
        assertEquals("pending@example.test", details.emailTemporary)
        assertTrue(details.newsletter)
    }

    @Test
    fun parsesContactsAndPublicReferences() {
        val contacts = parseContacts(JSONArray("""[{"_id":"contact-one","user":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"}}]"""))
        val references = parseReferences(JSONArray("""[{"_id":"reference-one","userFrom":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"},"feedbackPublic":"A thoughtful guest","response":{"feedbackPublic":"Thank you"}}]"""))
        assertEquals("Calm Lynx", contacts.single().user.label)
        assertEquals("A thoughtful guest", references.single().feedback)
        assertEquals("Thank you", references.single().response)
        val relationship = parseContactRelationship(
            JSONObject("""{"_id":"contact-nine","confirmed":true}"""),
        )
        assertEquals("contact-nine", relationship.id)
        assertTrue(relationship.confirmed)
    }

    @Test
    fun parsesMessageCreationTime() {
        val message = parseMessage(JSONObject("""{"_id":"message-one","content":"Hello","created":"2026-09-24T14:30:00.000Z","userFrom":{"username":"calm-lynx"}}"""))
        assertTrue(message.createdAt != null)
    }
    @Test
    fun classifiesAuthenticationFailures() {
        assertTrue(MobileApiException(401, "Signed out").isAuthenticationFailure)
        assertFalse(MobileApiException(403, "Forbidden").isAuthenticationFailure)
        assertFalse(MobileApiException(500, "Unavailable").isAuthenticationFailure)
    }

    @Test
    fun parsesExistingSignInMemberPayload() {
        val member = mobileMemberFrom(
            JSONObject(
                """{"username":"river-otter","displayName":"River Otter","public":true}""",
            ),
        )

        assertEquals("river-otter", member.username)
        assertEquals("River Otter", member.displayName)
    }

    @Test
    fun selectsMemberSessionFromMultipleResponseCookies() {
        val sessionCookie = sessionCookieFrom(
            mapOf(
                "set-cookie" to listOf(
                    "_passenger_route=route-value; Path=/; Secure",
                    "connect.sid=session-value; Path=/; HttpOnly",
                ),
            ),
        )

        assertEquals("connect.sid=session-value", sessionCookie)
    }

    @Test
    fun usesUsernameWhenDisplayNameIsAbsent() {
        val member = mobileMemberFrom(JSONObject("""{"username":"quiet-fox"}"""))

        assertEquals("quiet-fox", member.username)
        assertEquals("quiet-fox", member.displayName)
    }

    @Test
    fun usesUsernameWhenDisplayNameIsBlank() {
        val member = mobileMemberFrom(
            JSONObject("""{"username":"steady-heron","displayName":""}"""),
        )

        assertEquals("steady-heron", member.displayName)
    }

    @Test
    fun acceptsHttpsAndLocalEmulatorApiOrigins() {
        assertEquals(
            "https://www.trustroots.org",
            secureApiBaseURL("https://www.trustroots.org/"),
        )
        assertEquals(
            "http://10.0.2.2:13001",
            secureApiBaseURL("http://10.0.2.2:13001"),
        )
    }

    @Test
    fun rejectsRemoteCleartextAndNonOriginApiAddresses() {
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("http://api.example.test")
        }
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("https://member:secret@api.example.test")
        }
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("https://api.example.test/mobile?token=secret")
        }
    }

    @Test
    fun signsInWithJsonAndKeepsOnlyTheMemberSessionCookie() {
        val (result, request) = withApiResponse(
            status = 200,
            responseBody = """{"username":"quiet-fox","displayName":"Quiet Fox"}""",
            responseHeaders = listOf(
                "Set-Cookie: _passenger_route=route-value; Path=/; Secure",
                "Set-Cookie: connect.sid=session-value; Path=/; HttpOnly",
            ),
        ) { baseURL ->
            runBlocking { MobileApiClient(baseURL).signIn("quiet-fox", "fictional password") }
        }

        val session = result.getOrThrow()
        assertEquals("connect.sid=session-value", session.cookieHeader)
        assertEquals("Quiet Fox", session.member.displayName)
        assertEquals("POST /api/auth/signin HTTP/1.1", request.line)
        assertTrue(request.headers.any { it.equals("X-Trustroots-Request: 1", ignoreCase = true) })
        assertTrue(request.headers.any { it.equals("Content-Type: application/json", ignoreCase = true) })
        assertEquals(
            "quiet-fox",
            JSONObject(request.body).getString("username"),
        )
        assertEquals("fictional password", JSONObject(request.body).getString("password"))
    }

    @Test
    fun reportsAuthenticationStatusAndFallbackMessageFromMalformedErrorBody() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (result, request) = withApiResponse(status = 401, responseBody = "not JSON") { baseURL ->
            runBlocking { MobileApiClient(baseURL).currentMember(session) }
        }

        val error = result.exceptionOrNull() as MobileApiException
        assertTrue(error.isAuthenticationFailure)
        assertEquals("The request was not accepted.", error.message)
        assertEquals("GET /api/users/quiet-fox HTTP/1.1", request.line)
        assertTrue(request.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
        assertFalse(request.headers.any { it.startsWith("X-Trustroots-Request:", ignoreCase = true) })
    }

    @Test
    fun treatsMissingContactRelationshipAsAnUnconfirmedContact() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (result, request) = withApiResponse(status = 404, responseBody = "{}") { baseURL ->
            runBlocking { MobileApiClient(baseURL).contactWith(session, "member two") }
        }

        assertEquals(ContactRelationship(id = null, confirmed = false), result.getOrThrow())
        assertEquals("GET /api/contact-by/member+two HTTP/1.1", request.line)
    }

    @Test
    fun rejectsInvalidSearchInputBeforeOpeningAConnection() {
        val result = runBlocking {
            MobileApiClient("http://127.0.0.1:1").searchMembers(
                MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox")),
                "  ab  ",
            )
        }

        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }
}

private data class CapturedApiRequest(val line: String, val headers: List<String>, val body: String)

private fun <T> withApiResponse(
    status: Int,
    responseBody: String,
    responseHeaders: List<String> = emptyList(),
    call: (String) -> T,
): Pair<T, CapturedApiRequest> = ServerSocket(0).use { server ->
    val capturedRequests = LinkedBlockingQueue<CapturedApiRequest>()
    val worker = thread(isDaemon = true) {
        server.accept().use { socket ->
            val reader = socket.getInputStream().bufferedReader()
            val requestLine = reader.readLine()
            val headers = mutableListOf<String>()
            while (true) {
                val line = reader.readLine() ?: break
                if (line.isEmpty()) break
                headers += line
            }
            val contentLength = headers.firstOrNull { it.startsWith("Content-Length:", ignoreCase = true) }
                ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
            val body = CharArray(contentLength)
            var offset = 0
            while (offset < body.size) {
                val count = reader.read(body, offset, body.size - offset)
                if (count < 0) break
                offset += count
            }
            capturedRequests.put(CapturedApiRequest(requestLine.orEmpty(), headers, String(body, 0, offset)))

            val encodedBody = responseBody.toByteArray(Charsets.UTF_8)
            val response = buildString {
                append("HTTP/1.1 ").append(status).append(if (status in 200..299) " OK\r\n" else " Error\r\n")
                append("Content-Type: application/json\r\n")
                responseHeaders.forEach { append(it).append("\r\n") }
                append("Content-Length: ").append(encodedBody.size).append("\r\n")
                append("Connection: close\r\n\r\n")
            }.toByteArray(Charsets.UTF_8)
            socket.getOutputStream().use { output ->
                output.write(response)
                output.write(encodedBody)
            }
        }
    }
    try {
        val result = call("http://127.0.0.1:${server.localPort}")
        val request = capturedRequests.poll(5, TimeUnit.SECONDS)
        worker.join(1_000)
        result to requireNotNull(request) { "Expected the API request to reach the local server" }
    } finally {
        server.close()
        worker.join(1_000)
    }
}
