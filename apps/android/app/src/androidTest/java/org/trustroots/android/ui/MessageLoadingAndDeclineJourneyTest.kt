package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MessageLoadingAndDeclineJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalApiFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun inbox503ShowsFeedbackAnd401InvalidatesSession() {
        val inboxRequests = AtomicInteger()
        val invalidations = AtomicInteger()
        val local = startFixture { request ->
            if (request.path.startsWith("/api/messages?")) {
                when (inboxRequests.incrementAndGet()) {
                    1 -> Response(503, "{\"message\":\"Fictional inbox unavailable.\"}")
                    else -> Response(401, "{\"message\":\"Please sign in again.\"}")
                }
            } else {
                Response(404, "{}")
            }
        }
        var selectedCase by mutableStateOf("service-unavailable")
        compose.setContent {
            key(selectedCase) {
                MessageInboxScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session(if (selectedCase == "unauthorised") "second-session" else "first-session"),
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional inbox unavailable.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional inbox unavailable.").assertIsDisplayed()
        assertEquals(0, invalidations.get())

        compose.runOnUiThread { selectedCase = "unauthorised" }
        compose.waitUntil(10_000) {
            inboxRequests.get() >= 2 && invalidations.get() == 1 &&
                compose.onAllNodesWithText("No conversations yet.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitForIdle()
        compose.onNodeWithText("Messages").assertIsDisplayed()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        assertEquals(1, invalidations.get())
        assertEquals(2, local.requests.count { it.path.startsWith("/api/messages?") })
    }

    @Test fun conversation503ShowsFeedbackAnd401InvalidatesSession() {
        val conversationRequests = AtomicInteger()
        val invalidations = AtomicInteger()
        val local = startFixture { request ->
            if (request.path.startsWith("/api/messages/")) {
                when (conversationRequests.incrementAndGet()) {
                    1 -> Response(503, "{\"message\":\"Fictional conversation unavailable.\"}")
                    else -> Response(401, "{\"message\":\"Please sign in again.\"}")
                }
            } else {
                Response(404, "{}")
            }
        }
        var selectedCase by mutableStateOf("service-unavailable")
        compose.setContent {
            key(selectedCase) {
                ConversationScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session(if (selectedCase == "unauthorised") "second-session" else "first-session"),
                    member = if (selectedCase == "unauthorised") member("other-member-two") else member("other-member-one"),
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = {},
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional conversation unavailable.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional conversation unavailable.").assertIsDisplayed()
        assertEquals(0, invalidations.get())

        compose.runOnUiThread { selectedCase = "unauthorised" }
        compose.waitUntil(10_000) {
            conversationRequests.get() >= 2 && invalidations.get() == 1 &&
                compose.onAllNodesWithTag("messageComposer").fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitForIdle()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithTag("messageComposer").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithTag("quickReply").fetchSemanticsNodes().isEmpty())
        assertEquals(1, invalidations.get())
        assertTrue(local.requests.any { it.path.startsWith("/api/messages/other-member-two?") })
    }

    @Test fun declineQuickReplySendsHostingNoAndHidesQuickReplies() {
        val local = startFixture { request ->
            when {
                request.method == "POST" && request.path == "/api/messages" -> {
                    val posted = JSONObject(request.body)
                    val content = posted.getString("content")
                    Response(
                        200,
                        JSONObject()
                            .put("_id", "fictional-message-two")
                            .put("content", content)
                            .put("created", Instant.now().toString())
                            .put("userFrom", JSONObject().put("_id", "self-id").put("username", "steady-heron"))
                            .toString(),
                    )
                }
                request.path.startsWith("/api/messages/other-member-one?") -> Response(
                    200,
                    """[{"_id":"fictional-message-one","content":"<p>Can you host?</p>","created":"${Instant.now()}","userFrom":{"_id":"other-id","username":"quiet-fox"}}]""",
                )
                else -> Response(404, "{}")
            }
        }
        val session = session()
        val draftPreferences = compose.activity.getSharedPreferences("message_drafts", 0)
        val draftKey = "messages.thread.${session.member.username}-quiet-fox"
        val hadDraft = draftPreferences.contains(draftKey)
        val previousDraft = draftPreferences.getString(draftKey, null)
        draftPreferences.edit().remove(draftKey).commit()
        try {
            compose.setContent {
                ConversationScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    member = member("other-member-one"),
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("quickReply").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("quickReply").assertIsDisplayed()
            compose.onNodeWithText("Sorry I can't host").assertIsEnabled()
            compose.onNodeWithText("Sorry I can't host").performClick()
            compose.waitUntil(10_000) {
                local.requests.any { it.method == "POST" && it.path == "/api/messages" } &&
                    compose.onAllNodesWithText("Sorry I can't host").fetchSemanticsNodes().isNotEmpty() &&
                    compose.onAllNodesWithTag("quickReply").fetchSemanticsNodes().isEmpty()
            }
            val post = local.requests.single { it.method == "POST" && it.path == "/api/messages" }
            val body = JSONObject(post.body)
            assertEquals("other-member-one", body.getString("userTo"))
            assertEquals(
                """<p data-hosting="no"><b><i>Sorry I can't host</i></b></p>""",
                body.getString("content"),
            )
            assertTrue(compose.onAllNodesWithText("Sorry I can't host").fetchSemanticsNodes().isNotEmpty())
            assertTrue(compose.onAllNodesWithTag("quickReply").fetchSemanticsNodes().isEmpty())
        } finally {
            val edit = draftPreferences.edit()
            if (hadDraft) edit.putString(draftKey, previousDraft) else edit.remove(draftKey)
            edit.commit()
        }
    }

    private fun startFixture(handler: (Request) -> Response): LocalApiFixture =
        LocalApiFixture(handler).also { fixture = it }

    private fun session(cookie: String = "first-session") =
        MemberSession("connect.sid=$cookie", MobileMember("steady-heron", "Steady Heron"))

    private fun member(id: String) = MessageMember(id, "quiet-fox", "Quiet Fox")

    private data class Request(val method: String, val path: String, val body: String)
    private data class Response(val status: Int, val body: String)

    private class LocalApiFixture(handler: (Request) -> Response) {
        private val server = ServerSocket(0).apply { soTimeout = 250 }
        private val activeSocket = AtomicReference<Socket?>(null)
        private val failure = AtomicReference<Throwable?>(null)
        val requests = CopyOnWriteArrayList<Request>()
        val baseURL: String get() = "http://127.0.0.1:${server.localPort}"
        private val worker = thread(name = "message-test-http-fixture", isDaemon = true) {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        continue
                    } catch (error: IOException) {
                        if (server.isClosed) return@thread else throw error
                    }
                    activeSocket.set(socket)
                    socket.use {
                        it.soTimeout = 2_000
                        val request = readRequest(it)
                        requests += request
                        val response = handler(request)
                        val bytes = response.body.toByteArray(StandardCharsets.UTF_8)
                        val reason = if (response.status in 200..299) "OK" else "Test Response"
                        it.getOutputStream().write(
                            "HTTP/1.1 ${response.status} $reason\r\n".toByteArray(StandardCharsets.US_ASCII),
                        )
                        it.getOutputStream().write(
                            "Content-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(StandardCharsets.US_ASCII),
                        )
                        it.getOutputStream().write(bytes)
                        it.getOutputStream().flush()
                    }
                    activeSocket.set(null)
                }
            } catch (error: Throwable) {
                if (!server.isClosed || error !is IOException) failure.set(error)
            }
        }

        fun close() {
            server.close()
            activeSocket.getAndSet(null)?.close()
            worker.join(2_500)
            assertFalse("Local API fixture responder did not stop", worker.isAlive)
            failure.get()?.let { throw AssertionError("Local API fixture failed", it) }
        }

        private fun readRequest(socket: Socket): Request {
            val input = socket.getInputStream()
            val requestLine = readLine(input) ?: throw EOFException("Request line ended before data")
            val firstSpace = requestLine.indexOf(' ')
            val secondSpace = requestLine.indexOf(' ', firstSpace + 1)
            if (firstSpace <= 0 || secondSpace <= firstSpace) throw IOException("Malformed HTTP request line")
            val method = requestLine.substring(0, firstSpace)
            val path = requestLine.substring(firstSpace + 1, secondSpace)
            var contentLength = 0
            while (true) {
                val header = readLine(input) ?: throw EOFException("Headers ended before terminator")
                if (header.isEmpty()) break
                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                    contentLength = header.substringAfter(':').trim().toInt()
                }
            }
            val bodyBytes = ByteArray(contentLength)
            var offset = 0
            while (offset < contentLength) {
                val read = input.read(bodyBytes, offset, contentLength - offset)
                if (read < 0) throw EOFException("Request body ended at $offset of $contentLength bytes")
                offset += read
            }
            return Request(method, path, String(bodyBytes, StandardCharsets.UTF_8))
        }

        private fun readLine(input: java.io.InputStream): String? {
            val bytes = ByteArrayOutputStream()
            while (true) {
                val next = input.read()
                if (next < 0) return if (bytes.size() == 0) null else String(bytes.toByteArray(), StandardCharsets.US_ASCII)
                if (next == '\n'.code) break
                if (next != '\r'.code) bytes.write(next)
            }
            return String(bytes.toByteArray(), StandardCharsets.US_ASCII)
        }
    }
}
