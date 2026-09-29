package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
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
class ProfileEditingJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun editsOwnProfileAndShowsSavedFields() {
        val savedBody = AtomicReference("")
        thread(isDaemon = true) {
            repeat(10) {
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
                    if (request.startsWith("PUT ")) {
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) break
                            offset += count
                        }
                        savedBody.set(body.concatToString(0, offset))
                    }
                    val payload = when {
                        request.startsWith("PUT ") -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"New line","languages":["eng"]}"""
                        request.contains("/api/users/quiet-fox") -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Old line","languages":["eng"]}"""
                        else -> "[]"
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
            MemberProfileScreen(
                MobileApiClient("http://127.0.0.1:${server.localPort}"),
                MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                "quiet-fox", onSessionInvalidated = {}, onBack = {},
            )
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Old line").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Edit profile").performClick()
        compose.onNodeWithText("Tagline").performTextReplacement("New line")
        compose.onNodeWithText("Save profile").performClick()
        compose.waitUntil(10_000) { savedBody.get().isNotBlank() }
        assertTrue(savedBody.get().contains("\"tagline\":\"New line\""))
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("New line").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("New line").assertIsDisplayed()
    }
}
