package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ContactsScreenTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun showsEmptyContactsMessage() {
        thread(isDaemon = true) {
            repeat(4) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
                        request.contains("/api/contacts/") -> "[]"
                        else -> """{"_id":"member-one","username":"river-otter","displayName":"River Otter"}"""
                    }
                    val body = payload.toByteArray()
                    socket.getOutputStream().write(
                        """
                        HTTP/1.1 200 OK
                        Content-Type: application/json
                        Content-Length: ${body.size}
                        Connection: close

                        """.trimIndent().replace("\n", "\r\n").toByteArray() + body,
                    )
                }
            }
        }
        val api = MobileApiClient("http://127.0.0.1:${server.localPort}")
        val session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter"))
        compose.setContent {
            ContactsScreen(api = api, session = session, onSessionInvalidated = {}, onBack = {})
        }
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText("People you connect with on Trustroots will appear here.")
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        compose.onNodeWithText("People you connect with on Trustroots will appear here.").assertIsDisplayed()
        compose.onNodeWithText("Contacts").assertIsDisplayed()
    }
}
