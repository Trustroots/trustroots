package org.trustroots.android.ui

import org.trustroots.android.ui.account.AccountSettingsScreen

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class AccountLoadAndPasswordFailureJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val localFixtures = mutableListOf<LocalTransportFixture>()
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null

    @After fun stopOfflineApi() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
        localFixtures.forEach { runCatching { it.close() } }
    }

    @Test fun hostingLoadFailuresSeparateTemporaryErrorsFromExpiredSessions() {
        val invalidated = AtomicBoolean(false)
        val activeSession = mutableStateOf(session)
        startResponder { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" -> FixtureResponse(
                    200,
                    """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                request.method == "GET" && request.path == "/api/offers-by/member-one?types=host" -> FixtureResponse(
                    503,
                    """{"message":"Hosting details are temporarily unavailable."}""",
                )
                request.method == "GET" && request.path == "/api/users/amber-owl" -> FixtureResponse(
                    503,
                    """{"message":"The member profile is temporarily unavailable."}""",
                )
                request.method == "GET" && request.path == "/api/users/quiet-fox" -> FixtureResponse(
                    401,
                    """{"message":"Please sign in again."}""",
                )
                else -> FixtureResponse(404, "")
            }
        }
        compose.setContent {
            TrustrootsTheme {
                HostOfferScreen(
                    api = api(),
                    session = activeSession.value,
                    onSessionInvalidated = { invalidated.set(true) },
                    onBack = {},
                )
            }
        }

        waitForText("Hosting details are temporarily unavailable.")
        compose.onNodeWithText("Hosting details are temporarily unavailable.").assertIsDisplayed()
        compose.onNodeWithText("Retry").assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsNotEnabled()
        assertTrue(requests.any { it.path == "/api/users/steady-heron" })
        assertTrue(requests.any { it.path == "/api/offers-by/member-one?types=host" })
        assertFalse(invalidated.get())
        compose.runOnIdle {
            activeSession.value = MemberSession("connect.sid=fictional-session", MobileMember("amber-owl", "Amber Owl"))
        }
        waitForText("The member profile is temporarily unavailable.")
        compose.onNodeWithText("The member profile is temporarily unavailable.").assertIsDisplayed()
        compose.onNodeWithText("Retry").assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsNotEnabled()
        assertFalse(invalidated.get())
        compose.runOnIdle {
            activeSession.value = MemberSession("connect.sid=fictional-session", MobileMember("quiet-fox", "Quiet Fox"))
        }
        waitForInvalidatedWithoutLoading(invalidated)
        assertTrue(requests.any { it.path == "/api/users/quiet-fox" })
    }

    @Test fun accountLoadFailuresSeparateTemporaryErrorsFromExpiredSessions() {
        val invalidated = AtomicBoolean(false)
        val activeSession = mutableStateOf(session)
        startResponder { request ->
            when (request.method to request.path) {
                "GET" to "/api/users/steady-heron" -> FixtureResponse(
                    503,
                    """{"message":"Account details are temporarily unavailable."}""",
                )
                "GET" to "/api/users/quiet-fox" -> FixtureResponse(
                    401,
                    """{"message":"Please sign in again."}""",
                )
                else -> FixtureResponse(404, "")
            }
        }
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = api(),
                    session = activeSession.value,
                    onSessionInvalidated = { invalidated.set(true) },
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                )
            }
        }

        waitForText("Account details are temporarily unavailable.")
        compose.onNodeWithText("Account details are temporarily unavailable.").performScrollTo().assertIsDisplayed()
        assertFalse(invalidated.get())
        compose.runOnIdle {
            activeSession.value = MemberSession("connect.sid=fictional-session", MobileMember("quiet-fox", "Quiet Fox"))
        }
        waitForInvalidatedWithoutLoading(invalidated)
        assertTrue(requests.any { it.method == "GET" && it.path == "/api/users/steady-heron" })
        assertTrue(requests.any { it.method == "GET" && it.path == "/api/users/quiet-fox" })
    }

    @Test fun hostOfferRetriesWithRefreshedCookieOnlyAfterUserRequestsIt() {
        val activeSession = mutableStateOf(session)
        val invalidated = AtomicBoolean(false)
        val hostApi = api()
        startResponder { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" -> FixtureResponse(
                    200,
                    """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                request.method == "GET" && request.path == "/api/offers-by/member-one?types=host" &&
                    request.cookie == session.cookieHeader -> FixtureResponse(
                    503,
                    """{"message":"Hosting details are temporarily unavailable."}""",
                )
                request.method == "GET" && request.path == "/api/offers-by/member-one?types=host" -> FixtureResponse(
                    200,
                    """[{"_id":"offer-fresh","status":"yes","description":"A fresh fictional room","maxGuests":2}]""",
                )
                else -> FixtureResponse(404, "")
            }
        }
        compose.setContent {
            TrustrootsTheme {
                HostOfferScreen(
                    api = hostApi,
                    session = activeSession.value,
                    onSessionInvalidated = { invalidated.set(true) },
                    onBack = {},
                )
            }
        }

        waitForText("Hosting details are temporarily unavailable.")
        assertEquals(2, requests.size)
        compose.runOnIdle {
            activeSession.value = MemberSession(
                "connect.sid=refreshed-fictional-session",
                MobileMember("steady-heron", "Steady Heron"),
            )
        }
        compose.onNodeWithText("Retry").assertIsDisplayed()
        assertEquals("Refreshing credentials must not automatically replay the failed load", 2, requests.size)

        compose.onNodeWithText("Retry").performClick()
        waitForText("A fresh fictional room")
        assertFalse(invalidated.get())
        val profileRequests = requests.filter { it.path == "/api/users/steady-heron" }
        val offerRequests = requests.filter { it.path == "/api/offers-by/member-one?types=host" }
        assertEquals(listOf(session.cookieHeader, "connect.sid=refreshed-fictional-session"), profileRequests.map { it.cookie })
        assertEquals(listOf(session.cookieHeader, "connect.sid=refreshed-fictional-session"), offerRequests.map { it.cookie })
        compose.onNodeWithText("Save changes").assertIsEnabled()
    }

    @Test fun hostOfferReloadsFromANewBackendAndClearsTheOldFailure() {
        val firstBackend = LocalTransportFixture { request ->
            when (request.path) {
                "/api/users/steady-heron" -> LocalTransportFixture.Response(
                    """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                "/api/offers-by/member-one?types=host" ->
                    LocalTransportFixture.Response("""{"message":"First backend is unavailable."}""", 503)
                else -> LocalTransportFixture.Response("[]", 404)
            }
        }.also(localFixtures::add)
        val secondBackend = LocalTransportFixture { request ->
            when (request.path) {
                "/api/users/steady-heron" -> LocalTransportFixture.Response(
                    """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                "/api/offers-by/member-one?types=host" -> LocalTransportFixture.Response(
                    """[{"_id":"backend-offer","status":"yes","description":"A recovered backend room","maxGuests":2}]""",
                )
                else -> LocalTransportFixture.Response("[]", 404)
            }
        }.also(localFixtures::add)
        val activeApi = mutableStateOf(MobileApiClient(firstBackend.baseURL))
        val invalidated = AtomicBoolean(false)
        compose.setContent {
            TrustrootsTheme {
                HostOfferScreen(
                    api = activeApi.value,
                    session = session,
                    onSessionInvalidated = { invalidated.set(true) },
                    onBack = {},
                )
            }
        }

        waitForText("First backend is unavailable.")
        assertEquals(2, firstBackend.requests.size)
        compose.runOnIdle { activeApi.value = MobileApiClient(secondBackend.baseURL) }
        waitForText("A recovered backend room")

        assertEquals("The old backend failure should not survive a backend switch", 2, firstBackend.requests.size)
        assertTrue(secondBackend.requests.any { it.path == "/api/users/steady-heron" })
        assertTrue(secondBackend.requests.any { it.path == "/api/offers-by/member-one?types=host" })
        assertTrue(firstBackend.requests.all { it.cookie == session.cookieHeader })
        assertTrue(secondBackend.requests.all { it.cookie == session.cookieHeader })
        assertFalse(invalidated.get())
        compose.onNodeWithText("Save changes").assertIsEnabled()
    }

    @Test fun passwordFailureCanBeRetriedAndPreservesEnteredFields() {
        val invalidated = AtomicBoolean(false)
        val passwordAttempts = AtomicBoolean(false)
        startResponder { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" -> FixtureResponse(
                    200,
                    """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}""",
                )
                request.method == "POST" && request.path == "/api/users/password" -> {
                    if (passwordAttempts.compareAndSet(false, true)) {
                        FixtureResponse(503, """{"message":"Password service is temporarily unavailable."}""")
                    } else {
                        FixtureResponse(401, """{"message":"Please sign in again."}""")
                    }
                }
                else -> FixtureResponse(404, "")
            }
        }
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = api(),
                    session = session,
                    onSessionInvalidated = { invalidated.set(true) },
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                )
            }
        }
        waitForText("member@example.test")
        compose.onNodeWithText("Current password").performScrollTo().performTextReplacement("fictional-current")
        compose.onNodeWithText("New password").performScrollTo().performTextReplacement("fictional-new")
        compose.onNodeWithText("Verify new password").performScrollTo().performTextReplacement("fictional-new")
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().performClick()

        waitForText("Password service is temporarily unavailable.")
        compose.onNodeWithText("Password service is temporarily unavailable.").performScrollTo().assertIsDisplayed()
        assertFalse(invalidated.get())
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            invalidated.get() && requests.count { it.method == "POST" && it.path == "/api/users/password" } == 2 &&
                runCatching { compose.onNode(hasText("Change password") and hasClickAction()).assertIsEnabled() }.isSuccess
        }
        compose.waitForIdle()
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().assertIsEnabled()

        val attempts = requests.filter { it.method == "POST" && it.path == "/api/users/password" }
        assertEquals(2, attempts.size)
        attempts.forEach { request ->
            val body = JSONObject(request.body)
            assertEquals("fictional-current", body.getString("currentPassword"))
            assertEquals("fictional-new", body.getString("newPassword"))
            assertEquals("fictional-new", body.getString("verifyPassword"))
        }
        compose.onNodeWithText("Current password").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("New password").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Verify new password").performScrollTo().assertIsDisplayed()
        compose.waitForIdle()
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForInvalidatedWithoutLoading(invalidated: AtomicBoolean) {
        compose.waitUntil(10_000) { invalidated.get() }
        compose.waitForIdle()
        assertEquals(
            "Loading must finish when the expired session is reported",
            0,
            compose.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).fetchSemanticsNodes().size,
        )
    }

    private fun startResponder(replyFor: (CapturedRequest) -> FixtureResponse) {
        responder = thread(isDaemon = true, name = "account-failure-fixture") {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        return@thread
                    } catch (error: SocketException) {
                        if (server.isClosed) return@thread else throw error
                    }
                    activeSocket.set(socket)
                    try {
                        socket.soTimeout = 5_000
                        socket.use {
                            val input = socket.getInputStream()
                            val requestLine = readLine(input).orEmpty()
                            var contentLength = 0
                            var cookie: String? = null
                            while (true) {
                                val header = readLine(input) ?: break
                                if (header.isEmpty()) break
                                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                    contentLength = header.substringAfter(':').trim().toInt()
                                } else if (header.startsWith("Cookie:", ignoreCase = true)) {
                                    cookie = header.substringAfter(':').trim()
                                }
                            }
                            val request = CapturedRequest(
                                method = requestLine.substringBefore(' '),
                                path = requestLine.substringAfter(' ').substringBefore(' '),
                                body = String(readBody(input, contentLength), Charsets.UTF_8),
                                cookie = cookie,
                            )
                            requests += request
                            val response = replyFor(request)
                            val bytes = response.body.toByteArray(Charsets.UTF_8)
                            val reason = when (response.status) {
                                200 -> "OK"
                                401 -> "Unauthorized"
                                404 -> "Not Found"
                                503 -> "Service Unavailable"
                                else -> "Fixture Response"
                            }
                            val output = socket.getOutputStream()
                            output.write(
                                "HTTP/1.1 ${response.status} $reason\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                            )
                            output.write(bytes)
                            output.flush()
                        }
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) throw error
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
    }

    private fun readLine(input: java.io.InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val next = input.read()
            if (next < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            if (next == '\n'.code) {
                val line = bytes.toByteArray()
                val length = if (line.lastOrNull() == '\r'.code.toByte()) line.size - 1 else line.size
                return String(line, 0, length, Charsets.US_ASCII)
            }
            bytes.write(next)
        }
    }

    private fun readBody(input: java.io.InputStream, contentLength: Int): ByteArray {
        val body = ByteArray(contentLength)
        var offset = 0
        while (offset < contentLength) {
            val count = input.read(body, offset, contentLength - offset)
            if (count < 0) throw IOException("Request body ended before Content-Length")
            offset += count
        }
        return body
    }

    private data class CapturedRequest(val method: String, val path: String, val body: String, val cookie: String?)
    private data class FixtureResponse(val status: Int, val body: String)
}
