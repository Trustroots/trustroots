package org.trustroots.android.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
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
class HostOfferValidationRetryJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val saveBodies = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    @Test fun validatesDescriptionAndAllowsRetryAfterSaveFailure() {
        responder = thread(isDaemon = true) {
            repeat(4) { index ->
                val socket = acceptOrStop() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine().orEmpty()
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    val body = if (contentLength > 0) {
                        CharArray(contentLength).also { buffer ->
                            var offset = 0
                            while (offset < buffer.size) {
                                val count = input.read(buffer, offset, buffer.size - offset)
                                if (count < 0) break
                                offset += count
                            }
                        }.concatToString()
                    } else ""
                    if (request.startsWith("PUT ")) saveBodies += body
                    val status: String
                    val payload: String
                    when {
                        request.startsWith("GET /api/users/") -> {
                            status = "200 OK"
                            payload = """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}"""
                        }
                        request.startsWith("GET /api/offers-by/") -> {
                            status = "200 OK"
                            payload = """[{"_id":"offer-one","type":"host","user":"member-one","description":"","maxGuests":2,"showOnlyInMyCircles":false,"location":[48.69,9.14]}]"""
                        }
                        index == 2 -> {
                            status = "500 Internal Server Error"
                            payload = """{"message":"Local save failed."}"""
                        }
                        else -> {
                            status = "200 OK"
                            payload = """{"_id":"offer-one","status":"maybe","description":"A cosy spare room.","maxGuests":20,"showOnlyInMyCircles":false,"location":[48.69,9.14]}"""
                        }
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
            HostOfferScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) { compose.onAllNodesWithText("Write a longer hosting description first.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Yes").assertIsSelected()
        compose.onNodeWithText("Save changes").assertIsNotEnabled()
        compose.onNodeWithText("Hosting description").performTextReplacement("Room")
        compose.onNodeWithText("Write a longer hosting description first.").assertIsDisplayed()
        compose.onNodeWithText("Hosting description").performTextReplacement("A cosy spare room.")
        compose.onNodeWithText("Maybe").performClick()
        compose.onNodeWithText("Maximum guests").performTextReplacement("")
        compose.onNodeWithText("Maximum guests").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString("2"),
            ),
        )
        compose.onNodeWithText("Maximum guests").performTextReplacement("30")
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Local save failed.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Local save failed.").assertIsDisplayed()
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Hosting offer saved.").assertIsDisplayed()
        compose.waitUntil(5_000) { saveBodies.size == 2 }
        assertTrue(saveBodies.all {
            it.contains("\"status\":\"maybe\"") &&
                it.contains("\"maxGuests\":20") &&
                it.contains("\"showOnlyInMyCircles\":false")
        })
        responder?.join(1_000)
    }
}
