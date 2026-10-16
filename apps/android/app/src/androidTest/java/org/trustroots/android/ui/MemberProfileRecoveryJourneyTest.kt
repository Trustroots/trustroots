package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
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

@RunWith(AndroidJUnit4::class)
class MemberProfileRecoveryJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron"))

    @After fun closeServer() = server.close()

    @Test fun showsProfileRequestFailureAndReturnsToPreviousScreen() {
        val request = serveRequests(1) { "HTTP/1.1 503 Service Unavailable" to """{"message":"Profile is temporarily unavailable."}""" }
        var backCount = 0
        var invalidationCount = 0
        compose.setContent {
            MemberProfileScreen(
                api = api(),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = { invalidationCount++ },
                onBack = { backCount++ },
            )
        }

        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Profile is temporarily unavailable.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Profile is temporarily unavailable.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()

        assertEquals(1, backCount)
        assertEquals(0, invalidationCount)
        assertTrue(request.joinAndRead().startsWith("GET /api/users/quiet-fox "))
    }

    @Test fun invalidProfileSessionIsReportedToTheShell() {
        val request = serveRequests(1) { "HTTP/1.1 401 Unauthorized" to """{"message":"Please sign in again."}""" }
        var invalidationCount = 0
        compose.setContent {
            MemberProfileScreen(
                api = api(),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = { invalidationCount++ },
                onBack = {},
            )
        }

        compose.waitUntil(5_000) { invalidationCount == 1 }
        assertTrue(compose.onAllNodesWithText("Please sign in again.").fetchSemanticsNodes().isEmpty())
        assertTrue(request.joinAndRead().startsWith("GET /api/users/quiet-fox "))
    }

    @Test fun removesAConfirmedContactAndReturnsToAddContactAction() {
        val requests = CopyOnWriteArrayList<String>()
        val responder = thread(isDaemon = true) {
            repeat(12) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    requests += request
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val (status, payload) = if (request.contains("/avatar?")) {
                        "404 Not Found" to ""
                    } else when {
                        request.startsWith("GET /api/users/quiet-fox ") ->
                            "200 OK" to """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}"""
                        request.startsWith("GET /api/offers-by/") -> "200 OK" to "[]"
                        request.startsWith("GET /api/contacts/") -> "200 OK" to "[]"
                        request.startsWith("GET /api/experiences?") -> "200 OK" to "[]"
                        request.startsWith("GET /api/contact-by/") -> "200 OK" to """{"_id":"contact-one","confirmed":true}"""
                        request.startsWith("DELETE /api/contact/contact-one ") -> "200 OK" to "{}"
                        else -> "404 Not Found" to ""
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            MemberProfileScreen(
                api = api(),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Remove contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Remove contact").performClick()
        compose.onNodeWithText("Remove contact?").assertIsDisplayed()
        compose.onNodeWithText("You will no longer be contacts with this member.").assertIsDisplayed()
        compose.onNodeWithText("Confirm").performClick()
        compose.waitUntil(10_000) {
            requests.any { it.startsWith("DELETE /api/contact/contact-one ") } &&
                compose.onAllNodesWithText("Add contact").fetchSemanticsNodes().isNotEmpty()
        }

        assertTrue(requests.any { it.startsWith("DELETE /api/contact/contact-one ") })
        assertFalse(compose.onAllNodesWithText("Remove contact?").fetchSemanticsNodes().isNotEmpty())
        responder.join(1_000)
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun serveRequests(
        count: Int,
        response: (String) -> Pair<String, String>,
    ): RequestCapture {
        val requestLine = CopyOnWriteArrayList<String>()
        val responder = thread(isDaemon = true) {
            repeat(count) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    requestLine += request
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val (status, payload) = response(request)
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "$status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        return RequestCapture(requestLine, responder)
    }

    private data class RequestCapture(
        private val lines: List<String>,
        private val responder: Thread,
    ) {
        fun joinAndRead(): String {
            responder.join(1_000)
            return lines.single()
        }
    }
}
