package org.trustroots.android.ui

import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.unit.dp
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import android.graphics.Rect
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.time.Instant
import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.testing.KeyboardTestSupport
import org.trustroots.android.testing.foregroundActivityTask

@RunWith(AndroidJUnit4::class)
class ConversationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private lateinit var keyboardTestSupport: KeyboardTestSupport

    @Before fun resizeForKeyboardLikeTheMainActivity() {
        keyboardTestSupport = KeyboardTestSupport(
            InstrumentationRegistry.getInstrumentation().uiAutomation,
            compose.activity,
        )
        compose.activityRule.scenario.onActivity { activity ->
            activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    @After fun closeServer() {
        keyboardTestSupport.close()
        server.close()
    }

    @Test fun opensAtLatestMessageAndComposerStaysCloseToKeyboard() {
        val messages = (40 downTo 1).joinToString(prefix = "[", postfix = "]") { index ->
            """{"_id":"message-$index","content":"Fictional message $index","userFrom":{"_id":"member-one","username":"quiet-fox"}}"""
        }
        LocalTransportFixture { request ->
            when {
                request.path == "/api/messages/member-one?limit=100" -> LocalTransportFixture.Response(messages)
                request.path == "/api/users/mini/member-one" -> LocalTransportFixture.Response("""{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}""")
                else -> LocalTransportFixture.Response("[]")
            }
        }.use { local ->
            compose.setContent {
                ConversationRouteTestHarness(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                    memberID = "member-one", onSessionInvalidated = {},
                    contentPadding = PaddingValues(bottom = 80.dp),
                )
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Fictional message 40").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Fictional message 40").assertIsDisplayed()
            compose.onNodeWithTag("conversationMessages").performScrollToIndex(39)
            compose.onNodeWithText("Fictional message 1").assertIsDisplayed()
            foregroundActivityTask(
                compose,
                compose.activity,
                InstrumentationRegistry.getInstrumentation().uiAutomation,
            )
            compose.onNodeWithTag("messageComposer").performClick().performTextInput("A fictional draft")
            keyboardTestSupport.awaitShown(compose)
            compose.waitUntil(10_000) {
                ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
                    ?.isVisible(WindowInsetsCompat.Type.ime()) == true
            }
            compose.waitForIdle()
            val visible = Rect()
            compose.runOnUiThread { compose.activity.window.decorView.getWindowVisibleDisplayFrame(visible) }
            val composer = compose.onNodeWithTag("messageComposer").fetchSemanticsNode().boundsInWindow
            val gap = visible.bottom - composer.bottom
            val tolerance = 32 * compose.activity.resources.displayMetrics.density
            assertTrue("Composer gap above keyboard: $gap px", gap >= -1 && gap <= tolerance)
            hideTestKeyboard()
        }
    }

    @Test fun sendingFromOlderHistoryRevealsTheNewMessage() {
        val messages = (40 downTo 1).joinToString(prefix = "[", postfix = "]") { index ->
            """{"_id":"history-$index","content":"Older fictional note $index","userFrom":{"_id":"member-one","username":"quiet-fox"}}"""
        }
        LocalTransportFixture { request ->
            when {
                request.method == "POST" && request.path == "/api/messages" -> LocalTransportFixture.Response(
                    """{"_id":"sent-note","content":"My new fictional note","userFrom":{"_id":"self","username":"steady-heron"}}""",
                )
                request.path == "/api/messages/member-one?limit=100" -> LocalTransportFixture.Response(messages)
                request.path == "/api/users/mini/member-one" -> LocalTransportFixture.Response(
                    """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}""",
                )
                else -> LocalTransportFixture.Response("[]")
            }
        }.use { local ->
            compose.setContent {
                ConversationRouteTestHarness(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                    memberID = "member-one", onSessionInvalidated = {},
                )
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Older fictional note 40").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithContentDescription("Send").assertIsNotEnabled()
            compose.onNodeWithTag("messageComposer").performClick().performTextInput("My new fictional note")
            compose.onNodeWithContentDescription("Send").assertIsEnabled()
            hideTestKeyboard()
            compose.onNodeWithTag("conversationMessages").performScrollToIndex(39)
            compose.onNodeWithText("Older fictional note 1").assertIsDisplayed()
            compose.onNodeWithContentDescription("Send").performClick()
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("My new fictional note").fetchSemanticsNodes()
                    .any { it.config.contains(androidx.compose.ui.semantics.SemanticsProperties.Text) }
            }
            compose.onNodeWithText("My new fictional note").assertIsDisplayed()
        }
    }

    @Test fun multilineComposerSendsMessage() {
        val message = "Hello there\nA fictional follow-up."
        val postedResponse = JSONObject()
            .put("_id", "message-one")
            .put("content", message)
            .put("created", Instant.now().toString())
            .put("userFrom", JSONObject().put("_id", "mine").put("username", "steady-heron"))
            .toString()
        LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages?page=1&limit=50" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/messages/member-one?limit=100" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/users/mini/member-one" ->
                    LocalTransportFixture.Response("""{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}""")
                request.method == "POST" && request.path == "/api/messages" ->
                    LocalTransportFixture.Response(postedResponse)
                request.method == "GET" && request.path.startsWith("/api/users/member-one/avatar?") ->
                    LocalTransportFixture.Response("{}", status = 404)
                else -> error("Unexpected conversation request: ${request.method} ${request.path}")
            }
        }.use { local ->
            compose.setContent {
                ConversationRouteTestHarness(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    memberID = "member-one",
                    onSessionInvalidated = {},
                )
            }
            compose.onNodeWithTag("messageComposer").performTextInput(message)
            compose.onNodeWithContentDescription("Send").assertIsDisplayed()
            compose.onNodeWithContentDescription("Send").performClick()
            compose.waitUntil(10_000) {
                local.requests.any { it.method == "POST" && it.path == "/api/messages" } &&
                    compose.onAllNodesWithTag("outgoingMessage").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Just now").assertIsDisplayed()
            hideTestKeyboard()
            captureUsabilityScreenshot(compose, "android_conversation")
            compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
            compose.onNodeWithText("Messages").assertIsDisplayed()
            val postedRequest = local.requests.single { it.method == "POST" && it.path == "/api/messages" }
            assertEquals(message, JSONObject(postedRequest.body).getString("content"))
        }
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
                        request.startsWith("GET /api/users/mini/member-one") ->
                            """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}"""
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
            ConversationRouteTestHarness(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                memberID = "member-one",
                onSessionInvalidated = {},
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
}
