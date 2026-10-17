package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.semantics.getOrNull
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.time.Instant
import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ConversationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private var fixture: LocalTransportFixture? = null

    @After fun closeServer() {
        server.close()
        fixture?.close()
        fixture = null
    }

    @Test fun legacyMessageWithoutTimestampStillAppearsWithoutTimeLabel() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/fictional-neighbour?limit=100" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-message","content":"A fictional note without a timestamp.","userFrom":{"_id":"fictional-neighbour","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                    )
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            NativeTestAppFrame(Destination.Messages) {
                ConversationScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                    member = MessageMember("fictional-neighbour", "quiet-fox", "Quiet Fox"),
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/messages/fictional-neighbour?limit=100" } &&
                compose.onAllNodesWithText("A fictional note without a timestamp.")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        val message = compose.onNodeWithTag("incomingMessage", useUnmergedTree = true).fetchSemanticsNode()
        assertEquals(
            listOf("A fictional note without a timestamp."),
            messageText(message),
        )
        compose.onNodeWithText("A fictional note without a timestamp.").assertIsDisplayed()
    }

    private fun messageText(node: androidx.compose.ui.semantics.SemanticsNode): List<String> = buildList {
        node.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.Text)
            ?.forEach { add(it.text) }
        node.children.forEach { addAll(messageText(it)) }
    }

    @Test fun multilineComposerSendsMessage() {
        val posted = AtomicBoolean(false)
        val returnedToInbox = AtomicBoolean(false)
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
            NativeTestAppFrame(Destination.Messages) {
                ConversationScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    member = MessageMember("member-one", "quiet-fox", "Quiet Fox"),
                    onSessionInvalidated = {},
                    onBack = { returnedToInbox.set(true) },
                )
            }
        }
        compose.onNodeWithTag("messageComposer").performTextInput("Hello there")
        compose.onNodeWithContentDescription("Send").assertIsDisplayed()
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) {
            posted.get() && compose.onAllNodesWithText("Hello there").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Just now").assertIsDisplayed()
        hideTestKeyboard()
        captureUsabilityScreenshot(compose, "android_conversation")
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        assertTrue(returnedToInbox.get())
        responder.join(1_000)
    }

    @Test fun quickReplySendsHostingYes() {
        val postedBody = AtomicReference("")
        val responder = thread(isDaemon = true) {
            repeat(8) {
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
                    if (request.startsWith("POST")) {
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) break
                            offset += count
                        }
                        postedBody.set(body.concatToString(0, offset))
                    }
                    val payload = when {
                        request.startsWith("POST") ->
                            """{"_id":"message-two","content":"Yes, I can host!","created":"${Instant.now()}","userFrom":{"_id":"mine","username":"steady-heron"}}"""
                        request.contains("/api/messages/") ->
                            """[{"_id":"message-zero","content":"Can you host?","created":"${Instant.now()}","userFrom":{"_id":"member-one","username":"quiet-fox"}}]"""
                        else -> "[]"
                    }
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
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Yes, I can host!").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("quickReply").assertIsDisplayed()
        compose.onNodeWithText("Yes, I can host!").performClick()
        compose.waitUntil(10_000) {
            postedBody.get().contains("data-hosting") &&
                compose.onAllNodesWithText("Yes, I can host!", substring = false)
                    .fetchSemanticsNodes()
                    .size >= 1
        }
        assertTrue(JSONObject(postedBody.get()).getString("content").contains("data-hosting=\"yes\""))
        responder.join(1_000)
    }

    @Test fun writeBackQuickReplyMovesFocusToTheMessageComposer() {
        val memberID = "fictional-neighbour"
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/$memberID?limit=100" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-message","content":"Can you host?","userFrom":{"_id":"fictional-neighbour","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                    )
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            ConversationScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                member = MessageMember(memberID, "quiet-fox", "Quiet Fox"),
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/messages/$memberID?limit=100" } &&
                compose.onAllNodesWithText("Write back").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Write back").performClick()
        compose.onNodeWithTag("messageComposer").assertIsFocused()
        assertTrue(local.requests.none { it.method == "POST" })
    }
}
