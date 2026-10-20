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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
        assertEquals("Steady Heron", threads.single().otherMember.displayName)
        assertFalse(threads.single().read)
        val messages = parseMessages(JSONArray("""[{"_id":"message-one","content":"Hello","userFrom":{"username":"quiet-fox"}}]"""))
        assertEquals("Hello", messages.single().content)
    }

    @Test
    fun usesTheOtherConversationDirectionAndDefaultsMissingThreadFields() {
        val threads = parseThreads(
            JSONArray(
                """[{"_id":"thread-two","userFrom":{"username":"calm-lynx"},"userTo":{"username":"quiet-fox"},"message":"unexpected","read":"unexpected"}]""",
            ),
            "quiet-fox",
        )

        assertEquals("calm-lynx", threads.single().otherMember.username)
        assertEquals("", threads.single().excerpt)
        assertTrue(threads.single().read)
    }

    @Test
    fun parsesMapCoordinatesAndHostDetails() {
        val offers = parseMapOffers(JSONObject("""{"features":[{"properties":{"id":"offer-one","type":"host","status":"maybe"},"geometry":{"coordinates":[-9.1,38.7]}},{"properties":{"id":"invalid"},"geometry":{"coordinates":[200,38.7]}}]}"""))
        assertEquals(1, offers.size)
        assertEquals(38.7, offers.single().latitude, 0.0001)
        assertEquals("maybe", offers.single().status)
        val host = parseHostOffer(JSONObject("""{"_id":"offer-one","status":"yes","description":"A spare room","maxGuests":2,"user":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}"""))
        assertEquals("Quiet Fox", host.user.displayName)
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

        val malformedLocation = parseAccommodationOffer(
            JSONObject("""{"location":["unexpected",40.5]}"""),
        )
        assertNull(malformedLocation.latitude)
        assertEquals(40.5, malformedLocation.longitude!!, 0.0001)
    }

    @Test
    fun skipsMapFeaturesWithUnexpectedCoordinateLengthsAndUsesOfferDefaults() {
        val offers = parseMapOffers(
            JSONObject(
                """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1,38.7]}},{"properties":{"id":"short"},"geometry":{"coordinates":[1]}}]}""",
            ),
        )

        assertEquals(1, offers.size)
        assertEquals("host", offers.single().type)
        assertEquals("yes", offers.single().status)
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
        assertEquals("Calm Lynx", contacts.single().user.displayName)
        assertEquals("A thoughtful guest", references.single().feedback)
        assertEquals("Thank you", references.single().response)
        val relationship = parseContactRelationship(
            JSONObject("""{"_id":"contact-nine","confirmed":true}"""),
        )
        assertEquals("contact-nine", relationship.id)
        assertTrue(relationship.confirmed)
    }

    @Test
    fun skipsMalformedContactAndReferenceRows() {
        val contacts = parseContacts(
            JSONArray(
                """["unexpected",null,{"_id":"missing-user"},{"_id":"blank-user","user":"unexpected"},{"_id":"   ","user":{"username":"quiet-fox"}},{"_id":"contact-one","user":{"username":"quiet-fox"}}]""",
            ),
        )
        val references = parseReferences(
            JSONArray(
                """["unexpected",null,{"_id":"missing-author"},{"_id":"bad-author","userFrom":12},{"_id":"   ","userFrom":{"username":"quiet-fox"}},{"_id":"reference-one","userFrom":{"username":"quiet-fox"}}]""",
            ),
        )

        assertEquals(listOf("contact-one"), contacts.map { it.id })
        assertEquals(listOf("reference-one"), references.map { it.id })
    }

    @Test
    fun appliesMemberAndCircleFallbacksToUnexpectedOptionalFields() {
        val member = parseMember(
            JSONObject(
                """{"id":"member-fallback","username":"quiet-fox","displayName":"  ","locationFrom":"North Ridge","languages":{"unexpected":"shape"},"member":[null,{"tribe":"unexpected"},{"tribe":{"id":"circle-fallback","slug":"travellers","label":"Travellers","count":"unexpected","image":"unexpected"}},{"tribe":{"_id":"missing-slug","label":"Incomplete"}}]}""",
            ),
        )
        val circles = parseCircles(
            JSONArray(
                """[{"_id":"missing-slug","label":"Incomplete"},{"_id":"missing-label","slug":"travellers"},{"id":"circle-two","slug":"wanderers","label":"Wanderers","count":"unexpected","image":"unexpected"}]""",
            ),
        )

        assertEquals("member-fallback", member.id)
        assertEquals("quiet-fox", member.displayName)
        assertEquals("From North Ridge", member.location)
        assertEquals(emptyList<String>(), member.languages)
        assertEquals(listOf("circle-fallback"), member.circles.map { it.id })
        assertEquals(0, member.circles.single().count)
        assertFalse(member.circles.single().image)
        assertEquals(listOf("circle-two"), circles.map { it.id })
    }

    @Test
    fun defaultsOptionalAccountFieldsWithBlankOrUnexpectedValues() {
        val account = parseAccountDetails(
            JSONObject(
                """{"username":"quiet-fox","displayName":"  ","email":null,"emailTemporary":"  ","newsletter":"unexpected"}""",
            ),
        )

        assertEquals("quiet-fox", account.displayName)
        assertEquals("", account.email)
        assertNull(account.emailTemporary)
        assertFalse(account.newsletter)
    }

    @Test
    fun parsesMessageCreationTime() {
        val message = parseMessage(JSONObject("""{"_id":"message-one","content":"Hello","created":"2026-09-24T14:30:00.000Z","userFrom":{"username":"calm-lynx"}}"""))
        assertTrue(message.createdAt != null)

        val invalidTimestamp = parseMessage(
            JSONObject("""{"_id":"message-two","content":"Hello","created":"not a date","userFrom":{"username":"calm-lynx"}}"""),
        )
        assertNull(invalidTimestamp.createdAt)
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
        assertThrows(IllegalArgumentException::class.java) {
            secureApiBaseURL("https://api.example.test/mobile")
        }
    }

    @Test fun encodesAvatarIdentifiersAndUsesTheDefaultThumbnailSize() {
        val api = MobileApiClient("https://api.example.test/")
        assertEquals(
            "https://api.example.test/api/users/member%2Fone/avatar?size=128",
            api.avatarURL("member/one").toString(),
        )
    }

    @Test fun readsCircleMembershipIdentifiersAndSkipsIncompleteReferences() {
        val session = MemberSession("connect.sid=fictional", MobileMember("quiet-fox", "Quiet Fox"))
        val (result, request) = withApiResponse(
            200,
            """[{"tribe":{"_id":"circle-one"}},{"tribe":{"id":"circle-two"}},{"tribe":{}},{"tribe":null},{}]""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).circleMemberships(session) } }
        assertEquals(setOf("circle-one", "circle-two"), result.getOrThrow())
        assertEquals("GET /api/users/memberships HTTP/1.1", request.line)
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
    fun reportsSignInRejectionKindWithoutInventingFallbackMessage() {
        val (result, _) = withApiResponse(
            status = 401,
            responseBody = "not JSON",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).signIn("quiet-fox", "fictional password") } }

        val error = result.exceptionOrNull() as MobileApiException
        assertEquals(ApiFailureKind.SIGN_IN_REJECTED, error.failureKind)
        assertNull(error.serverMessage)
        assertNull(error.message)
    }

    @Test
    fun preservesSignInServerMessageWithSignInFailureKind() {
        val (result, _) = withApiResponse(
            status = 401,
            responseBody = """{"message":"A fictional sign-in response."}""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).signIn("quiet-fox", "fictional password") } }

        val error = result.exceptionOrNull() as MobileApiException
        assertEquals(ApiFailureKind.SIGN_IN_REJECTED, error.failureKind)
        assertEquals("A fictional sign-in response.", error.serverMessage)
        assertEquals("A fictional sign-in response.", error.message)
    }

    @Test
    fun reportsMissingSessionAsContextFreeFailure() {
        val (result, _) = withApiResponse(
            status = 200,
            responseBody = """{"username":"quiet-fox","displayName":"Quiet Fox"}""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).signIn("quiet-fox", "fictional password") } }

        val error = result.exceptionOrNull() as MobileApiException
        assertEquals(ApiFailureKind.MISSING_SESSION, error.failureKind)
        assertNull(error.serverMessage)
        assertNull(error.message)
    }

    @Test
    fun reportsAuthenticationStatusAndContextFreeFailureKindFromMalformedErrorBody() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (result, request) = withApiResponse(status = 401, responseBody = "not JSON") { baseURL ->
            runBlocking { MobileApiClient(baseURL).accountDetails(session) }
        }

        val error = result.exceptionOrNull() as MobileApiException
        assertTrue(error.isAuthenticationFailure)
        assertNull(error.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, error.failureKind)
        assertNull(error.message)
        assertEquals("GET /api/users/quiet-fox HTTP/1.1", request.line)
        assertTrue(request.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
        assertFalse(request.headers.any { it.startsWith("X-Trustroots-Request:", ignoreCase = true) })
    }

    @Test
    fun preservesServerErrorMessagesAndUsesKindForBlankMessages() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (specificResult, _) = withApiResponse(
            status = 403,
            responseBody = """{"message":"This fictional account cannot access the page."}""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).accountDetails(session) } }
        val (blankResult, _) = withApiResponse(
            status = 503,
            responseBody = """{"message":"   "}""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).accountDetails(session) } }

        val specificError = specificResult.exceptionOrNull() as MobileApiException
        val blankError = blankResult.exceptionOrNull() as MobileApiException
        assertEquals(403, specificError.statusCode)
        assertEquals("This fictional account cannot access the page.", specificError.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, specificError.failureKind)
        assertEquals(503, blankError.statusCode)
        assertNull(blankError.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, blankError.failureKind)
        assertNull(blankError.message)
    }

    @Test
    fun rejectsMalformedOrIncompleteSuccessfulJsonResponses() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val malformed = withApiResponse(status = 200, responseBody = "not JSON") { baseURL ->
            runBlocking { MobileApiClient(baseURL).profile(session, "calm-lynx") }
        }.first
        val incomplete = withApiResponse(status = 200, responseBody = "{}") { baseURL ->
            runBlocking { MobileApiClient(baseURL).profile(session, "calm-lynx") }
        }.first

        assertFalse(malformed.isSuccess)
        assertFalse(malformed.exceptionOrNull() is MobileApiException)
        assertFalse(incomplete.isSuccess)
        assertFalse(incomplete.exceptionOrNull() is MobileApiException)
    }

    @Test
    fun rejectsUnexpectedSuccessfulResponseShapes() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val contacts = withApiResponse(status = 200, responseBody = "{}") { baseURL ->
            runBlocking { MobileApiClient(baseURL).contacts(session, "member-one") }
        }.first
        val nostrVisibility = withApiResponse(status = 200, responseBody = """{"linkedPubkeys":"unexpected"}""") { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).visibleNostrAuthors(
                    session,
                    setOf("a".repeat(64)),
                )
            }
        }.first

        assertFalse(contacts.isSuccess)
        assertFalse(contacts.exceptionOrNull() is MobileApiException)
        assertFalse(nostrVisibility.isSuccess)
        assertFalse(nostrVisibility.exceptionOrNull() is MobileApiException)
    }

    @Test
    fun rejectsInvalidMapCoordinatesInSuccessfulResponses() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val result = withApiResponse(
            status = 200,
            responseBody = """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":["unexpected",38.7]}}]}""",
        ) { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).searchOffers(session, -10.0, -15.0, 60.0, 5.0)
            }
        }.first

        assertFalse(result.isSuccess)
        assertFalse(result.exceptionOrNull() is MobileApiException)
    }

    @Test
    fun requiresAMemberSessionCookieAfterSuccessfulSignIn() {
        val (result, request) = withApiResponse(
            status = 200,
            responseBody = """{"username":"quiet-fox","displayName":"Quiet Fox"}""",
            responseHeaders = listOf("Set-Cookie: _passenger_route=route-value; Path=/; Secure"),
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).signIn("quiet-fox", "fictional password") } }

        val failure = result.exceptionOrNull() as? MobileApiException
        assertNotNull(failure)
        assertEquals(ApiFailureKind.MISSING_SESSION, failure?.failureKind)
        assertNull(failure?.serverMessage)
        assertNull(failure?.message)
        assertEquals("POST /api/auth/signin HTTP/1.1", request.line)
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
    fun propagatesContactLookupFailuresOtherThanNotFound() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val result = withApiResponse(
            status = 503,
            responseBody = """{"message":"The fictional contact service is unavailable."}""",
        ) { baseURL ->
            runBlocking { MobileApiClient(baseURL).contactWith(session, "member-one") }
        }.first

        val error = result.exceptionOrNull() as MobileApiException
        assertEquals(503, error.statusCode)
        assertEquals("The fictional contact service is unavailable.", error.message)
    }

    @Test
    fun signsOutWithTheExplicitCsrfHeaderAndSessionCookie() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (result, request) = withApiResponse(status = 204, responseBody = "") { baseURL ->
            runBlocking { MobileApiClient(baseURL).signOut(session) }
        }

        assertTrue(result.isSuccess)
        assertEquals("POST /api/auth/signout HTTP/1.1", request.line)
        assertTrue(request.headers.any { it.equals("X-Trustroots-Request: 1", ignoreCase = true) })
        assertTrue(request.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
    }

    @Test
    fun readsEnabledAndDisabledMessagePushConfiguration() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (disabled, disabledRequest) = withApiResponse(
            status = 200,
            responseBody = """{"enabled":false,"publicKey":"unused-key"}""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).messagePushConfiguration(session) } }
        val (enabled, enabledRequest) = withApiResponse(
            status = 200,
            responseBody = """{"enabled":true,"publicKey":"fictional-public-key"}""",
        ) { baseURL -> runBlocking { MobileApiClient(baseURL).messagePushConfiguration(session) } }

        assertEquals(null, disabled.getOrThrow())
        assertEquals("fictional-public-key", enabled.getOrThrow())
        assertEquals("GET /api/users/unified-push HTTP/1.1", disabledRequest.line)
        assertEquals(disabledRequest.line, enabledRequest.line)
        assertTrue(enabledRequest.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
    }

    @Test
    fun registersAndUnregistersMessagePushEndpoints() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (registered, registerRequest) = withApiResponse(status = 200, responseBody = "{}") { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).registerMessagePush(
                    session,
                    "https://push.example.test/fictional-endpoint",
                    "fictional-public-key",
                    "fictional-auth",
                )
            }
        }
        val (unregistered, unregisterRequest) = withApiResponse(status = 200, responseBody = "{}") { baseURL ->
            runBlocking {
                MobileApiClient(baseURL).unregisterMessagePush(
                    session,
                    "https://push.example.test/fictional-endpoint",
                )
            }
        }

        assertTrue(registered.isSuccess)
        assertEquals("POST /api/users/unified-push HTTP/1.1", registerRequest.line)
        assertEquals(
            "fictional-public-key",
            JSONObject(registerRequest.body).getString("publicKey"),
        )
        assertTrue(unregistered.isSuccess)
        assertEquals("DELETE /api/users/unified-push HTTP/1.1", unregisterRequest.line)
        assertTrue(unregisterRequest.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
        assertEquals(
            "https://push.example.test/fictional-endpoint",
            JSONObject(unregisterRequest.body).getString("endpoint"),
        )
    }

    @Test
    fun removesAContactUsingItsEncodedIdentifier() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        val (result, request) = withApiResponse(status = 200, responseBody = "{}") { baseURL ->
            runBlocking { MobileApiClient(baseURL).removeContact(session, "member two") }
        }

        assertTrue(result.isSuccess)
        assertEquals("DELETE /api/contact/member+two HTTP/1.1", request.line)
        assertTrue(request.headers.any { it.equals("Cookie: connect.sid=session-value", ignoreCase = true) })
    }

    @Test
    fun filtersNostrAuthorsAcrossMultipleVisibilityBatches() {
        val authors = (0..100).map { index -> index.toString(16).padStart(64, '0') }.toSet()
        val linked = authors.first()
        val visibleLinked = authors.drop(1).first()
        val server = ServerSocket(0)
        val requests = LinkedBlockingQueue<String>()
        val worker = thread(isDaemon = true) {
            repeat(2) {
                val socket = runCatching { server.accept() }.getOrNull() ?: return@thread
                socket.use {
                    val reader = socket.getInputStream().bufferedReader()
                    requests.put(reader.readLine().orEmpty())
                    while (!reader.readLine().isNullOrEmpty()) Unit
                    val body = """{"linkedPubkeys":["$linked","$visibleLinked"],"pubkeys":["$visibleLinked"]}"""
                    val bytes = body.toByteArray(Charsets.UTF_8)
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))
        try {
            val result = runBlocking {
                MobileApiClient("http://127.0.0.1:${server.localPort}").visibleNostrAuthors(session, authors)
            }
            val requestLines = listOf(
                requests.poll(5, TimeUnit.SECONDS),
                requests.poll(5, TimeUnit.SECONDS),
            )
            worker.join(1_000)

            assertEquals(authors - linked, result.getOrThrow())
            assertEquals(2, requestLines.size)
            assertTrue(requestLines.all { it?.startsWith("GET /api/nostr/author-visibility?") == true })
            assertTrue(requestLines.any { it?.contains("pubkey=$linked") == true })
            assertTrue(requestLines.any { it?.contains("pubkey=$visibleLinked") == true })
        } finally {
            server.close()
            worker.join(1_000)
        }
    }

    @Test
    fun returnsImmediatelyWhenThereAreNoNostrAuthorsToCheck() {
        val session = MemberSession("connect.sid=session-value", MobileMember("quiet-fox", "Quiet Fox"))

        val result = runBlocking {
            MobileApiClient("http://127.0.0.1:1").visibleNostrAuthors(session, emptySet())
        }

        assertEquals(emptySet<String>(), result.getOrThrow())
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
