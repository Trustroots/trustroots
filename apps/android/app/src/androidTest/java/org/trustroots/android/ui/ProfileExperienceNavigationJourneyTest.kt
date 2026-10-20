package org.trustroots.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
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
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class ProfileExperienceNavigationJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron"))
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
    }

    @Test fun cancelsAndReopensExperienceFormThenReturnsToProfileAfterSaving() {
        respondToRequests { request ->
            when {
                request.startsWith("POST /api/experiences ") -> HttpReply(201, "{}")
                else -> profileReply(request)
            }
        }
        compose.setContent { profile() }

        openExperienceForm()
        compose.onNodeWithContentDescription("Cancel").performClick()
        openExperienceMenu()
        compose.onNodeWithText("Share your experience").assertIsDisplayed()

        openExperienceForm()
        compose.onNodeWithText("Experience with Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Save changes").performClick()
        openExperienceMenu()
        compose.onNodeWithText("Share your experience").assertIsDisplayed()

        assertTrue(requests.any { it.line.startsWith("POST /api/experiences ") && it.body.contains("\"userTo\":\"member-two\"") })
        assertTrue(compose.onAllNodesWithText("Experience with Quiet Fox").fetchSemanticsNodes().isEmpty())
    }

    @Test fun recoversFromSaveFailureAndReturnsToProfileAfterRetry() {
        var saveAttempts = 0
        respondToRequests { request ->
            when {
                request.startsWith("POST /api/experiences ") && ++saveAttempts == 1 ->
                    HttpReply(503, """{"message":"Local save failed."}""")
                request.startsWith("POST /api/experiences ") -> HttpReply(201, "{}")
                else -> profileReply(request)
            }
        }
        compose.setContent { profile() }

        openExperienceForm()
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Local save failed.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Local save failed.").assertIsDisplayed()
        compose.onNodeWithText("Experience with Quiet Fox").assertIsDisplayed()

        compose.onNodeWithText("Save changes").performClick()
        openExperienceMenu()
        compose.onNodeWithText("Share your experience").assertIsDisplayed()

        val saves = requests.filter { it.line.startsWith("POST /api/experiences ") }
        assertTrue("The failed save should be retried", saves.size >= 2)
        assertTrue(saves.all { it.body.contains("\"userTo\":\"member-two\"") })
        assertTrue(compose.onAllNodesWithText("Experience with Quiet Fox").fetchSemanticsNodes().isEmpty())
    }

    @Composable
    private fun profile() = MemberProfileScreen(
        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
        session = session,
        username = "quiet-fox",
        onSessionInvalidated = {},
        onBack = {},
    )

    private fun openExperienceForm() {
        openExperienceMenu()
        compose.onNodeWithText("Share your experience").performClick()
        compose.onNodeWithText("Experience with Quiet Fox").assertIsDisplayed()
    }

    private fun openExperienceMenu() {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("More profile actions").fetchSemanticsNodes().isNotEmpty()
        }
        if (compose.onAllNodesWithText("Share your experience").fetchSemanticsNodes().isNotEmpty()) return
        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Share your experience").fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun profileReply(request: String): HttpReply = when {
        request.startsWith("GET /api/users/quiet-fox ") -> HttpReply(
            200,
            """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
        )
        request.startsWith("GET /api/offers-by/member-two?") -> HttpReply(200, "[]")
        request.startsWith("GET /api/contacts/member-two ") -> HttpReply(200, "[]")
        request.startsWith("GET /api/experiences?userTo=member-two ") -> HttpReply(200, "[]")
        request.startsWith("GET /api/contact-by/member-two ") -> HttpReply(404, """{"message":"No contact."}""")
        else -> HttpReply(404, "")
    }

    private fun respondToRequests(replyFor: (String) -> HttpReply) {
        responder = thread(isDaemon = true, name = "profile-experience-fixture") {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        return@thread
                    } catch (error: SocketException) {
                        if (server.isClosed) return@thread else throw error
                    }
                    activeSocket.set(socket)
                    socket.soTimeout = 5_000
                    socket.use {
                        val input = socket.getInputStream()
                        val line = readLine(input)
                        var contentLength = 0
                        while (true) {
                            val header = readLine(input) ?: break
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val body = readBody(input, contentLength)
                        requests += CapturedRequest(line.orEmpty(), String(body, Charsets.UTF_8))
                        val reply = replyFor(line.orEmpty())
                        val bytes = reply.body.toByteArray(Charsets.UTF_8)
                        val phrase = if (reply.status == 201) "Created" else when (reply.status) {
                            200 -> "OK"
                            404 -> "Not Found"
                            503 -> "Service Unavailable"
                            else -> "Fixture Response"
                        }
                        val output = socket.getOutputStream()
                        output.write(
                            "HTTP/1.1 ${reply.status} $phrase\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        output.write(bytes)
                        output.flush()
                    }
                    activeSocket.compareAndSet(socket, null)
                }
            } catch (error: IOException) {
                if (!server.isClosed) throw error
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
    }

    private fun readLine(input: java.io.InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val next = input.read()
            if (next < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            if (next == '\n'.code) {
                val line = bytes.toByteArray()
                val length = if (line.lastOrNull() == '\r'.code.toByte()) line.size - 1 else line.size
                return String(line, 0, length, Charsets.US_ASCII)
            }
            bytes.write(next)
        }
    }

    private fun readBody(input: java.io.InputStream, contentLength: Int): ByteArray {
        val body = ByteArray(contentLength)
        var offset = 0
        while (offset < contentLength) {
            val count = input.read(body, offset, contentLength - offset)
            if (count < 0) throw IOException("Request body ended before Content-Length")
            offset += count
        }
        return body
    }

    private data class CapturedRequest(val line: String, val body: String)
    private data class HttpReply(val status: Int, val body: String)
}
