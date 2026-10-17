package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MessageAlertNavigationTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private var fixture: LocalTransportFixture? = null

    @After fun closeServer() {
        server.close()
        fixture?.close()
        fixture = null
    }

    @Test fun alertOpensMatchingConversation() {
        thread(isDaemon = true) {
            repeat(4) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = if (request.contains("/api/messages/member-one?")) {
                        "[]"
                    } else {
                        """[{"_id":"thread-one","userFrom":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"mine","username":"steady-heron","displayName":"Steady Heron"},"read":false}]"""
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        compose.setContent {
            MessageInboxScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                initialMemberID = "member-one",
            )
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithTag("messageComposer").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("messageComposer").assertIsDisplayed()
    }

    @Test fun staleAlertFallsBackToInboxWhenConversationIsGone() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages?page=1&limit=50" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-thread","userFrom":{"_id":"active-member","username":"amber-owl","displayName":"Amber Owl"},"userTo":{"_id":"fictional-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A recent fictional note."},"read":false}]""",
                    )
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            MessageInboxScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                initialMemberID = "departed-member",
            )
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/messages?page=1&limit=50" } &&
                compose.onAllNodesWithText("A recent fictional note.")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Amber Owl").assertIsDisplayed()
        compose.onNodeWithText("A recent fictional note.").assertIsDisplayed()
        compose.onNodeWithTag("messageComposer").assertDoesNotExist()
        assertEquals(1, local.requests.count { it.path == "/api/messages?page=1&limit=50" })
        assertTrue(local.requests.none { it.path == "/api/messages/departed-member?limit=100" })
    }
}
