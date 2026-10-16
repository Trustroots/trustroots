package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
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
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CirclesMembershipFailureJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-circles-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @After fun closeFixture() {
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        assertFalse("The local circles responder should stop after server shutdown", responder?.isAlive == true)
    }

    @Test fun showsMembershipLoadErrorWhileKeepingCirclesAvailable() {
        val invalidatedCalls = AtomicInteger()
        startResponder(membershipStatus = 503)
        showCircles { invalidatedCalls.incrementAndGet() }

        waitForText("Quiet Harbour")
        waitForText("Membership data is temporarily unavailable.")
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Membership data is temporarily unavailable.").assertIsDisplayed()
        compose.onNodeWithText("Join").assertIsDisplayed()
        assertEquals(0, invalidatedCalls.get())
        assertTrue(requests.any { it.startsWith("GET /api/tribes?limit=150 ") })
        assertTrue(requests.any { it.startsWith("GET /api/users/memberships ") })
    }

    @Test fun invalidMembershipSessionIsReportedAfterCirclesLoad() {
        val invalidatedCalls = AtomicInteger()
        startResponder(membershipStatus = 401)
        showCircles { invalidatedCalls.incrementAndGet() }

        waitForText("Quiet Harbour")
        compose.waitUntil(5_000) { invalidatedCalls.get() == 1 }
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Join").assertIsDisplayed()
        assertFalse(compose.onAllNodesWithText("Please sign in again.").fetchSemanticsNodes().isNotEmpty())
        assertEquals(1, invalidatedCalls.get())
        assertTrue(requests.any { it.startsWith("GET /api/tribes?limit=150 ") })
        assertTrue(requests.any { it.startsWith("GET /api/users/memberships ") })
    }

    private fun showCircles(onSessionInvalidated: () -> Unit) {
        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    onSessionInvalidated = onSessionInvalidated,
                )
            }
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startResponder(membershipStatus: Int) {
        responder = thread(isDaemon = true, name = "circles-memberships-local-api") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket = socket
                try {
                    socket.soTimeout = 2_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        requests += request
                        while (!input.readLine().isNullOrEmpty()) Unit
                        val (status, body) = fixtureResponse(request, membershipStatus)
                        val bytes = body.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 $status\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw IOException("Local circles fixture could not complete a request", error)
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun fixtureResponse(request: String, membershipStatus: Int): Pair<String, String> = when {
        request.startsWith("GET /api/tribes?limit=150 ") -> "200 OK" to CIRCLES
        request.startsWith("GET /api/users/memberships ") -> when (membershipStatus) {
            401 -> "401 Unauthorized" to """{"message":"Please sign in again."}"""
            else -> "503 Service Unavailable" to """{"message":"Membership data is temporarily unavailable."}"""
        }
        else -> "404 Not Found" to "{}"
    }

    private companion object {
        const val CIRCLES = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":4,"description":"A fictional circle for coastal travellers.","image":false}]"""
    }
}
