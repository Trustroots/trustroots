package org.trustroots.android.api

import java.net.ServerSocket
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApiOperationsTest {
    private val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))

    @Test
    fun updatesAccountWithTrimmedEmailAndParsesSavedDetails() {
        val (result, request) = withApiResponse(
            responseBody = """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet@example.test","newsletter":false}""",
        ) { baseURL ->
            runBlocking { MobileApiClient(baseURL).updateAccount(session, "  quiet@example.test  ", false) }
        }

        val account = result.getOrThrow()
        assertEquals("quiet@example.test", account.email)
        assertFalse(account.newsletter)
        assertEquals("PUT /api/users HTTP/1.1", request.line)
        assertEquals("quiet@example.test", JSONObject(request.body).getString("email"))
        assertFalse(JSONObject(request.body).getBoolean("newsletter"))
        assertAuthenticatedRequest(request)
    }

    @Test
    fun changesPasswordWithAllVerificationFields() {
        val (result, request) = withApiResponse(responseBody = "{}") { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).changePassword(
                    session,
                    currentPassword = "old fictional password",
                    newPassword = "new fictional password",
                    verifyPassword = "new fictional password",
                )
            }
        }

        result.getOrThrow()
        val body = JSONObject(request.body)
        assertEquals("POST /api/users/password HTTP/1.1", request.line)
        assertEquals("old fictional password", body.getString("currentPassword"))
        assertEquals("new fictional password", body.getString("newPassword"))
        assertEquals("new fictional password", body.getString("verifyPassword"))
        assertAuthenticatedRequest(request)
    }

    @Test
    fun savesNewHostOfferAndParsesReturnedOffer() {
        val (result, request) = withApiResponse(
            responseBody = """{"_id":"offer-one","status":"maybe","description":"A spare bed","noOfferDescription":"Away this month","maxGuests":2,"showOnlyInMyCircles":true,"location":[51.5,-0.12]}""",
        ) { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).saveHostOffer(
                    session,
                    HostOfferUpdate(
                        status = "maybe",
                        description = "  A spare bed  ",
                        noOfferDescription = "  Away this month  ",
                        maxGuests = 2,
                        showOnlyInMyCircles = true,
                        latitude = 51.5,
                        longitude = -0.12,
                    ),
                )
            }
        }

        val offer = result.getOrThrow()
        assertEquals("offer-one", offer.id)
        assertEquals("maybe", offer.status)
        assertEquals(51.5, offer.latitude!!, 0.0001)
        assertEquals(-0.12, offer.longitude!!, 0.0001)
        assertEquals("POST /api/offers HTTP/1.1", request.line)
        val body = JSONObject(request.body)
        assertEquals("host", body.getString("type"))
        assertEquals("maybe", body.getString("status"))
        assertEquals("A spare bed", body.getString("description"))
        assertEquals("Away this month", body.getString("noOfferDescription"))
        assertEquals(2, body.getInt("maxGuests"))
        assertTrue(body.getBoolean("showOnlyInMyCircles"))
        assertEquals(51.5, body.getJSONArray("location").getDouble(0), 0.0001)
        assertEquals(-0.12, body.getJSONArray("location").getDouble(1), 0.0001)
        assertAuthenticatedRequest(request)
    }

    @Test
    fun updatesAnExistingHostOfferUsingItsEncodedIdentifier() {
        val (result, request) = withApiResponse(
            responseBody = """{"_id":"offer one","status":"yes","description":"A room","maxGuests":1,"location":[48.8,2.3]}""",
        ) { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).saveHostOffer(
                    session,
                    HostOfferUpdate(
                        id = "offer one",
                        status = "yes",
                        description = "A room",
                        noOfferDescription = "",
                        maxGuests = 1,
                        showOnlyInMyCircles = false,
                        latitude = 48.8,
                        longitude = 2.3,
                    ),
                )
            }
        }

        assertEquals("offer one", result.getOrThrow().id)
        assertEquals("PUT /api/offers/offer+one HTTP/1.1", request.line)
        assertEquals("yes", JSONObject(request.body).getString("status"))
        assertAuthenticatedRequest(request)
    }

    @Test
    fun createsAnExperienceWithInteractionAndRecommendationFields() {
        val (result, request) = withApiResponse(responseBody = "{}") { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).createExperience(
                    session,
                    ExperienceCreate(
                        userTo = "member-two",
                        met = true,
                        guest = false,
                        host = true,
                        recommend = "yes",
                        feedbackPublic = "  A considerate guest  ",
                    ),
                )
            }
        }

        result.getOrThrow()
        assertEquals("POST /api/experiences HTTP/1.1", request.line)
        val body = JSONObject(request.body)
        assertEquals("member-two", body.getString("userTo"))
        assertTrue(body.getJSONObject("interactions").getBoolean("met"))
        assertFalse(body.getJSONObject("interactions").getBoolean("guest"))
        assertTrue(body.getJSONObject("interactions").getBoolean("host"))
        assertEquals("yes", body.getString("recommend"))
        assertEquals("A considerate guest", body.getString("feedbackPublic"))
        assertAuthenticatedRequest(request)
    }

    @Test
    fun sendsSortedMapFiltersAndParsesOfferCoordinates() {
        val response = """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[-0.12,51.5]}}]}"""
        val (result, request) = withApiResponse(responseBody = response) { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).searchOffers(
                    session = session,
                    south = 50.0,
                    west = -1.0,
                    north = 52.0,
                    east = 1.0,
                    types = setOf("meet", "host"),
                    circleIDs = setOf("circle-z", "circle-a"),
                    seenMonths = 6,
                    languages = setOf("fra", "eng"),
                )
            }
        }

        val offer = result.getOrThrow().single()
        assertEquals("offer-one", offer.id)
        assertEquals(51.5, offer.latitude, 0.0001)
        assertEquals(-0.12, offer.longitude, 0.0001)
        assertTrue(request.line.startsWith("GET /api/offers?southWestLat=50.0&southWestLng=-1.0&northEastLat=52.0&northEastLng=1.0&filters="))
        val encodedFilters = request.line.substringAfter("&filters=").substringBefore(" HTTP/")
        val filters = JSONObject(URLDecoder.decode(encodedFilters, StandardCharsets.UTF_8.name()))
        assertEquals(listOf("host", "meet"), filters.getJSONArray("types").strings())
        assertEquals(listOf("circle-a", "circle-z"), filters.getJSONArray("tribes").strings())
        assertEquals(6, filters.getJSONObject("seen").getInt("months"))
        assertEquals(listOf("eng", "fra"), filters.getJSONArray("languages").strings())
        assertAuthenticatedRequest(request, hasJsonBody = false, hasTrustrootsRequestHeader = false)
    }

    @Test
    fun loadsBlockedMembersFromAuthenticatedUncachedEndpoint() {
        val (result, request) = withApiResponse(
            responseBody = """[{"_id":"member-id","username":"reported-member","displayName":"Reported Member"}]""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).blockedMembers(session) } }

        val member = result.getOrThrow().single()
        assertEquals("reported-member", member.username)
        assertEquals("Reported Member", member.displayName)
        assertEquals("GET /api/blocked-users HTTP/1.1", request.line)
        assertAuthenticatedRequest(
            request, hasJsonBody = false, hasTrustrootsRequestHeader = false,
        )
    }

    @Test
    fun blocksMemberUsingEncodedUsernameAndAcceptsPlainTextSuccess() {
        val (result, request) = withApiResponse(responseBody = "Member added to block list.") { baseURL ->
            runBlocking { MobileApiClient(baseURL).setMemberBlocked(session, "quiet fox/one", blocked = true) }
        }

        result.getOrThrow()
        assertEquals("PUT /api/blocked-users/quiet%20fox%2Fone HTTP/1.1", request.line)
        assertAuthenticatedRequest(request, hasJsonBody = false)
    }

    @Test
    fun unblocksMemberWithDelete() {
        val (result, request) = withApiResponse(responseBody = "{}") { baseURL ->
            runBlocking { MobileApiClient(baseURL).setMemberBlocked(session, "reported-member", blocked = false) }
        }

        result.getOrThrow()
        assertEquals("DELETE /api/blocked-users/reported-member HTTP/1.1", request.line)
        assertAuthenticatedRequest(request, hasJsonBody = false)
    }

    @Test
    fun reportsMemberThroughAuthenticatedSupportRoute() {
        val (result, request) = withApiResponse(responseBody = "{}") { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).reportMember(
                    session, "reported-member", "  This profile contains abusive content.  ",
                )
            }
        }

        result.getOrThrow()
        assertEquals("POST /api/support HTTP/1.1", request.line)
        val body = JSONObject(request.body)
        assertEquals("reported-member", body.getString("reportMember"))
        assertEquals("This profile contains abusive content.", body.getString("message"))
        assertAuthenticatedRequest(request)
    }

    @Test
    fun rejectsBlankMemberReportWithoutSendingRequest() {
        val result = runBlocking {
            MobileApiClient("http://127.0.0.1:1").reportMember(session, "reported-member", "  \n")
        }

        assertTrue(result.isFailure)
    }

    @Test
    fun rejectsBlankUsernameForBlockMutationBeforeSendingRequest() {
        val result = runBlocking {
            MobileApiClient("http://127.0.0.1:1").setMemberBlocked(session, "  \n", blocked = true)
        }

        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun rejectsBlankUsernameForMemberReportBeforeSendingRequest() {
        val result = runBlocking {
            MobileApiClient("http://127.0.0.1:1").reportMember(session, "  \n", "Fictional report")
        }

        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun preservesServerErrorsFromMemberSafetyRequests() {
        val (result, request) = withApiResponse(
            responseBody = """{"message":"You cannot block this member."}""",
            responseCode = 403,
        ) { baseURL ->
            runBlocking { MobileApiClient(baseURL).setMemberBlocked(session, "reported-member", blocked = true) }
        }

        val error = result.exceptionOrNull() as MobileApiException
        assertEquals(403, error.statusCode)
        assertEquals("You cannot block this member.", error.serverMessage)
        assertEquals("PUT /api/blocked-users/reported-member HTTP/1.1", request.line)
        assertAuthenticatedRequest(request, hasJsonBody = false)
    }
}

private data class CapturedOperationRequest(val line: String, val headers: List<String>, val body: String)

private fun assertAuthenticatedRequest(
    request: CapturedOperationRequest,
    hasJsonBody: Boolean = true,
    hasTrustrootsRequestHeader: Boolean = true,
) {
    assertTrue(request.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
    assertEquals(
        hasTrustrootsRequestHeader,
        request.headers.any { it.equals("X-Trustroots-Request: 1", ignoreCase = true) },
    )
    if (hasJsonBody) {
        assertTrue(request.headers.any { it.equals("Content-Type: application/json", ignoreCase = true) })
    }
}

private fun org.json.JSONArray.strings(): List<String> =
    (0 until length()).map { getString(it) }

private fun <T> withApiResponse(
    responseBody: String,
    responseCode: Int = 200,
    call: (String) -> T,
): Pair<T, CapturedOperationRequest> = ServerSocket(0).use { server ->
    val capturedRequests = LinkedBlockingQueue<CapturedOperationRequest>()
    val worker = thread(isDaemon = true) {
        val socket = runCatching { server.accept() }.getOrNull() ?: return@thread
        socket.use {
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
            capturedRequests.put(CapturedOperationRequest(requestLine.orEmpty(), headers, String(body, 0, offset)))

            val encodedBody = responseBody.toByteArray(Charsets.UTF_8)
            val response = buildString {
                append("HTTP/1.1 ").append(responseCode)
                append(if (responseCode in 200..299) " OK\r\n" else " Forbidden\r\n")
                append("Content-Type: application/json\r\n")
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
