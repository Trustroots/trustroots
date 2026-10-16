package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ScreenApiFailureJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0)
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("river-otter", "River Otter"),
    )
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val hostSaveAttempts = AtomicInteger()
    private val accountSaveAttempts = AtomicInteger()
    private var responder: Thread? = null
    @Volatile private var activeSocket: java.net.Socket? = null

    @Before fun startOfflineApi() {
        responder = thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket = socket
                try {
                    socket.use {
                        socket.soTimeout = 5_000
                        val input = socket.getInputStream().bufferedReader()
                        val requestLine = input.readLine().orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine().orEmpty()
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val bodyBuffer = CharArray(contentLength)
                        var offset = 0
                        while (offset < bodyBuffer.size) {
                            val count = input.read(bodyBuffer, offset, bodyBuffer.size - offset)
                            if (count < 0) throw java.io.EOFException("Incomplete fixture request body")
                            offset += count
                        }
                        val body = bodyBuffer.concatToString(0, offset)
                        val request = CapturedRequest(
                            method = requestLine.substringBefore(' '),
                            path = requestLine.substringAfter(' ').substringBefore(' '),
                            body = body,
                        )
                        requests += request
                        val response = responseFor(request)
                        val responseBytes = response.body.toByteArray()
                        socket.getOutputStream().write(
                            "HTTP/1.1 ${response.status}\r\nContent-Type: application/json\r\nContent-Length: ${responseBytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        socket.getOutputStream().write(responseBytes)
                        socket.getOutputStream().flush()
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    @After fun stopOfflineApi() {
        server.close()
        activeSocket?.close()
        responder?.join(1_000)
    }

    @Test fun hostOfferSaveFailureKeepsChangesAndExpiredSessionInvalidates() {
        val invalidated = AtomicBoolean(false)
        compose.setContent {
            TrustrootsTheme {
                HostOfferScreen(
                    api = api(),
                    session = session,
                    onSessionInvalidated = { invalidated.set(true) },
                    onBack = {},
                )
            }
        }

        waitForText("Comfortable place to stay.")
        compose.onNodeWithText("Hosting description")
            .performTextReplacement("A welcoming spare room.")
        compose.onNodeWithText("Save changes").performClick()
        waitForText("The hosting offer could not be saved.")
        compose.onNodeWithText("The hosting offer could not be saved.").assertIsDisplayed()
        compose.onNodeWithText("A welcoming spare room.").assertIsDisplayed()
        assertEquals(1, hostSaveAttempts.get())

        compose.onNodeWithText("Save changes").assertIsEnabled().performClick()
        compose.waitUntil(5_000) { invalidated.get() }
        assertEquals(2, hostSaveAttempts.get())
        assertEquals(2, requests.count { it.method == "PUT" && it.path == "/api/offers/offer-one" })
        assertEquals(
            "A welcoming spare room.",
            JSONObject(requests.last { it.path == "/api/offers/offer-one" }.body).getString("description"),
        )
    }

    @Test fun accountSaveFailureKeepsEmailAndExpiredSessionInvalidates() {
        val invalidated = AtomicBoolean(false)
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

        waitForText("river@example.test")
        compose.onNodeWithText("Email address")
            .performScrollTo()
            .performTextReplacement("new@example.test")
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()
        waitForText("Account details could not be saved.")
        compose.onNodeWithText("Account details could not be saved.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("new@example.test").assertIsDisplayed()
        assertEquals(1, accountSaveAttempts.get())

        compose.onNodeWithText("Save email settings").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(5_000) { invalidated.get() }
        assertEquals(2, accountSaveAttempts.get())
        val updates = requests.filter { it.method == "PUT" && it.path == "/api/users" }
        assertEquals(2, updates.size)
        updates.forEach { assertEquals("new@example.test", JSONObject(it.body).getString("email")) }
    }

    @Test fun initialCircleLoadFailureIsShownEvenWhenMembershipsLoad() {
        val invalidated = AtomicBoolean(false)
        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = api(),
                    session = session,
                    onSessionInvalidated = { invalidated.set(true) },
                )
            }
        }

        waitForText("The circle directory is temporarily unavailable.")
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithText("The circle directory is temporarily unavailable.").assertIsDisplayed()
        assertTrue(requests.any { it.path == "/api/users/memberships" })
        assertTrue(requests.any { it.path == "/api/tribes?limit=150" })
        assertTrue(!invalidated.get())
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun responseFor(request: CapturedRequest): FixtureResponse = when {
        request.method == "GET" && request.path == "/api/users/river-otter" -> FixtureResponse(
            "200 OK",
            """{"_id":"member-one","username":"river-otter","displayName":"River Otter","email":"river@example.test","newsletter":false}""",
        )
        request.method == "GET" && request.path == "/api/offers-by/member-one?types=host" -> FixtureResponse(
            "200 OK",
            """[{"_id":"offer-one","status":"yes","description":"<p>Comfortable place to stay.</p>","noOfferDescription":"","maxGuests":2,"location":[48.69,9.14]}]""",
        )
        request.method == "PUT" && request.path == "/api/offers/offer-one" -> {
            if (hostSaveAttempts.incrementAndGet() == 1) {
                FixtureResponse("503 Service Unavailable", """{"message":"The hosting offer could not be saved."}""")
            } else {
                FixtureResponse("401 Unauthorized", """{"message":"Session expired."}""")
            }
        }
        request.method == "PUT" && request.path == "/api/users" -> {
            if (accountSaveAttempts.incrementAndGet() == 1) {
                FixtureResponse("503 Service Unavailable", """{"message":"Account details could not be saved."}""")
            } else {
                FixtureResponse("401 Unauthorized", """{"message":"Session expired."}""")
            }
        }
        request.method == "GET" && request.path == "/api/tribes?limit=150" -> FixtureResponse(
            "503 Service Unavailable",
            """{"message":"The circle directory is temporarily unavailable."}""",
        )
        request.method == "GET" && request.path == "/api/users/memberships" -> FixtureResponse("200 OK", "[]")
        else -> FixtureResponse("404 Not Found", "")
    }

    private data class CapturedRequest(val method: String, val path: String, val body: String)
    private data class FixtureResponse(val status: String, val body: String)
}
