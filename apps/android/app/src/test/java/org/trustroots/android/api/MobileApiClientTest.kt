package org.trustroots.android.api

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test
import kotlinx.coroutines.runBlocking
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress

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
    fun verifiesSigninProofUsingTheServerHashFormat() {
        assertTrue(isSigninProofSolution("fictional-challenge", 13049))
        assertFalse(isSigninProofSolution("fictional-challenge", 13048))
    }

    @Test
    fun doesNotTreatPreAuthCookieOnMfaChallengeAsMemberSession() = runBlocking {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        var requests = 0
        server.createContext("/api/auth/signin") { exchange ->
            requests += 1
            val (status, body) = if (requests == 1) {
                429 to """{"signinChallenge":{"token":"fictional-challenge","difficulty":14}}"""
            } else {
                202 to """{"username":"quiet-fox","displayName":"Quiet Fox","public":true,"mfaRequired":true,"challenge":"pre-auth-challenge"}"""
            }
            exchange.responseHeaders.add("Content-Type", "application/json")
            if (requests == 2) {
                exchange.responseHeaders.add("Set-Cookie", "connect.sid=pre-auth-session; Path=/; HttpOnly")
            }
            val response = body.toByteArray()
            exchange.sendResponseHeaders(status, response.size.toLong())
            exchange.responseBody.use { it.write(response) }
        }
        server.start()

        try {
            val result = MobileApiClient("http://127.0.0.1:${server.address.port}")
                .signIn("quiet-fox", "fictional-password")
            val error = result.exceptionOrNull()
            val mobileError = error as? MobileApiException

            assertEquals("Proof retry failed: ${error?.message}", 2, requests)
            assertTrue("An MFA challenge must not produce a member session", result.isFailure)
            assertTrue(mobileError != null)
            assertEquals(202, mobileError?.statusCode)
            assertTrue(mobileError?.message.orEmpty().contains("browser", ignoreCase = true))
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun rejectsMfaMarkerEvenWhenResponseStatusIsSuccessful() = runBlocking {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/api/auth/signin") { exchange ->
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.responseHeaders.add("Set-Cookie", "connect.sid=pre-auth-session; Path=/; HttpOnly")
            val body = """{"username":"quiet-fox","displayName":"Quiet Fox","public":true,"mfaRequired":true,"challenge":"pre-auth-challenge"}"""
                .toByteArray()
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()

        try {
            val result = MobileApiClient("http://127.0.0.1:${server.address.port}")
                .signIn("quiet-fox", "fictional-password")
            val error = result.exceptionOrNull() as? MobileApiException

            assertTrue("An MFA marker must not produce a member session", result.isFailure)
            assertEquals(202, error?.statusCode)
            assertTrue(error?.message.orEmpty().contains("browser", ignoreCase = true))
        } finally {
            server.stop(0)
        }
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
}
