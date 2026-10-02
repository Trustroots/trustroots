package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class CreateExperienceScreenTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun sharesExperienceWithMember() {
        val posted = AtomicReference("")
        val created = AtomicBoolean(false)
        thread(isDaemon = true) {
            repeat(4) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    if (request.startsWith("POST ")) {
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) break
                            offset += count
                        }
                        posted.set(body.concatToString(0, offset))
                    }
                    val payload = """{"_id":"experience-one"}"""
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        compose.setContent {
            CreateExperienceScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                memberID = "member-two",
                memberLabel = "Calm Lynx",
                onSessionInvalidated = {},
                onBack = {},
                onCreated = { created.set(true) },
            )
        }
        compose.onNodeWithText("Experience with Calm Lynx").assertIsDisplayed()
        compose.onNodeWithText("Share").performClick()
        compose.waitUntil(5_000) { created.get() }
        assertTrue(posted.get().contains("\"userTo\":\"member-two\""))
        assertTrue(posted.get().contains("\"met\":true"))
    }
}
