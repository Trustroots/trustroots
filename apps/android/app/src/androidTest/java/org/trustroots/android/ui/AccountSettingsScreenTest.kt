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
class AccountSettingsScreenTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun showsEmailNewsletterAndPasswordControls() {
        thread(isDaemon = true) {
            repeat(4) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload =
                        """{"username":"river-otter","displayName":"River Otter","email":"river@example.test","newsletter":true}"""
                    val body = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(body)
                }
            }
        }
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                onSessionInvalidated = {},
                onBack = {},
                onResetPassword = {},
                onSignedOut = {},
            )
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("river@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Account").assertIsDisplayed()
        compose.onNodeWithText("Community newsletter").assertIsDisplayed()
        compose.onNodeWithText("Change password").assertIsDisplayed()
        compose.onNodeWithText("Sign out").assertIsDisplayed()
    }
}
