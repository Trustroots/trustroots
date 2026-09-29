package org.trustroots.android.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.time.Instant
import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ConversationJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun keyboardSendActionSendsMessage() {
        val posted = AtomicBoolean(false)
        val responder = thread(isDaemon = true) {
            repeat(6) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine()
                    if (request.startsWith("POST")) posted.set(true)
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = if (request.startsWith("POST")) {
                        """{"_id":"message-one","content":"Hello there","created":"${Instant.now()}","userFrom":{"_id":"mine","username":"steady-heron"}}"""
                    } else "[]"
                    val bytes = if (request.contains("/avatar?")) {
                        ByteArrayOutputStream().also { output ->
                            Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                                .compress(Bitmap.CompressFormat.PNG, 100, output)
                        }.toByteArray()
                    } else payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            ConversationScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                member = MessageMember("member-one", "quiet-fox", "Quiet Fox"),
                onSessionInvalidated = {},
                onBack = {},
            )
        }
        compose.onNodeWithText("Message").performTextInput("Hello there")
        compose.onNodeWithText("Send").assertIsDisplayed()
        compose.onNodeWithText("Message").performImeAction()
        compose.waitUntil(10_000) {
            posted.get() && compose.onAllNodesWithText("Hello there").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Just now").assertIsDisplayed()
        responder.join(1_000)
    }
}
