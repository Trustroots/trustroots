package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

/** Verifies large message app bars collapse and expand through real scroll gestures. */
@RunWith(AndroidJUnit4::class)
class MessageHeaderCollapseJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val session = MemberSession(
        "connect.sid=fictional-message-header-session",
        MobileMember("member-self", "Steady Heron"),
    )
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        responder?.join(1_000)
        assertTrue("The local message fixture should stop after server shutdown", responder?.isAlive != true)
    }

    @Test fun inboxHeaderCollapsesAndExpandsWithConversationListGestures() {
        var statusBarInsetPx = 0f
        startResponder { request ->
            when {
                request.startsWith("GET /api/messages?") -> "200 OK" to inboxPayload()
                request.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to "{}"
            }
        }
        compose.setContent {
            val density = LocalDensity.current
            val systemBarsPadding = WindowInsets.systemBars.asPaddingValues()
            statusBarInsetPx = WindowInsets.statusBars.getTop(density).toFloat()
            TrustrootsTheme {
                MessageInboxScreen(
                    MobileApiClient(baseUrl),
                    session,
                    onSessionInvalidated = {},
                    contentPadding = systemBarsPadding,
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional message 1").fetchSemanticsNodes().isNotEmpty()
        }
        val titleBefore = compose.onNodeWithText("Messages").fetchSemanticsNode().boundsInRoot
        assertTrue(
            "The expanded inbox title starts below the real status bar inset",
            titleBefore.top >= statusBarInsetPx,
        )
        val rowBefore = compose.onNodeWithText("Fictional message 1").fetchSemanticsNode().boundsInRoot
        println("MESSAGE_HEADER inbox expanded title=$titleBefore firstRow=$rowBefore")
        captureUsabilityScreenshot(compose, "android_message_inbox_expanded")

        compose.onNode(hasScrollAction()).performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.onNodeWithText("Messages").assertIsDisplayed()
        compose.onNodeWithText("Fictional message 1").assertDoesNotExist()
        val titleAfter = compose.onNodeWithText("Messages").fetchSemanticsNode().boundsInRoot
        assertTrue("Scrolling shrinks the inbox title into its collapsed app bar", titleAfter.height < titleBefore.height)
        println("MESSAGE_HEADER inbox collapsed title=$titleAfter firstRowVisible=false")
        captureUsabilityScreenshot(compose, "android_message_inbox_collapsed")

        repeat(3) {
            compose.onNode(hasScrollAction()).performTouchInput { swipeDown() }
            compose.waitForIdle()
        }
        compose.onNodeWithText("Filter conversations").assertIsDisplayed()
        val titleExpanded = compose.onNodeWithText("Messages").fetchSemanticsNode().boundsInRoot
        assertTrue("Scrolling back expands the inbox title", titleExpanded.height > titleAfter.height)
        println("MESSAGE_HEADER inbox expandedAgain title=$titleExpanded")
        captureUsabilityScreenshot(compose, "android_message_inbox_expanded_again")
        compose.onNodeWithText("Filter conversations").performTextInput("traveller-28")
        compose.onNodeWithText("Traveller 28").assertIsDisplayed()
        compose.onNodeWithText("Traveller 1").assertDoesNotExist()
    }

    @Test fun conversationHeaderCollapsesAndExpandsWithHistoryGestures() {
        var statusBarInsetPx = 0f
        var startInsetPx = 0f
        var rootWidthPx = 0f
        var backInsetUpperBoundPx = 0f
        startResponder { request ->
            when {
                request.startsWith("GET /api/users/mini/member-one ") -> "200 OK" to
                    """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}"""
                request.startsWith("GET /api/messages/member-one?") -> "200 OK" to conversationPayload()
                request.startsWith("GET /api/users/quiet-fox ") -> "200 OK" to
                    """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","member":[]}"""
                request.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to "{}"
            }
        }
        compose.setContent {
            val density = LocalDensity.current
            val systemBarsPadding = WindowInsets.systemBars.asPaddingValues()
            statusBarInsetPx = WindowInsets.statusBars.getTop(density).toFloat()
            backInsetUpperBoundPx = with(density) { 32.dp.toPx() }
            val contentPadding = PaddingValues(
                start = systemBarsPadding.calculateStartPadding(LayoutDirection.Rtl) + 32.dp,
                top = systemBarsPadding.calculateTopPadding(),
                end = systemBarsPadding.calculateEndPadding(LayoutDirection.Rtl) + 12.dp,
                bottom = systemBarsPadding.calculateBottomPadding(),
            )
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                val direction = LocalLayoutDirection.current
                startInsetPx = with(density) { contentPadding.calculateStartPadding(direction).toPx() }
                ConversationRouteTestHarness(
                    api = MobileApiClient(baseUrl),
                    session = session,
                    memberID = "member-one",
                    onSessionInvalidated = {},
                    contentPadding = contentPadding,
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional conversation note 30")
                .fetchSemanticsNodes().isNotEmpty()
        }
        val titleBefore = compose.onNodeWithText("Quiet Fox").fetchSemanticsNode().boundsInRoot
        val backBefore = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        rootWidthPx = compose.onRoot().fetchSemanticsNode().boundsInRoot.width
        assertTrue(
            "The conversation title starts below the real status bar inset",
            titleBefore.top >= statusBarInsetPx,
        )
        assertTrue(
            "The Back action starts below the status bar without receiving the top inset twice",
            backBefore.top >= statusBarInsetPx && backBefore.top < statusBarInsetPx + backInsetUpperBoundPx,
        )
        assertTrue("RTL places Back at logical start on the right", backBefore.left > rootWidthPx / 2f)
        assertTrue(
            "RTL Back respects the asymmetric logical start inset",
            rootWidthPx - backBefore.right >= startInsetPx,
        )
        val messageBefore = compose.onNodeWithText("Fictional conversation note 30").fetchSemanticsNode().boundsInRoot
        println("MESSAGE_HEADER conversation expanded title=$titleBefore back=$backBefore message=$messageBefore")
        captureUsabilityScreenshot(compose, "android_message_conversation_expanded")

        val history = compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange))
        history.performTouchInput { swipeUp() }
        compose.waitForIdle()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        compose.onNodeWithText("View profile").assertIsDisplayed()
        val titleAfter = compose.onNodeWithText("Quiet Fox").fetchSemanticsNode().boundsInRoot
        val backAfter = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        val messageAfter = compose.onNodeWithText("Fictional conversation note 30").fetchSemanticsNode().boundsInRoot
        assertTrue(history.fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value() > 0f)
        assertTrue("Scrolling shrinks the participant title into its collapsed app bar", titleAfter.height < titleBefore.height)
        assertEquals("The Back action remains available in the collapsed app bar", backBefore.size, backAfter.size)
        assertNotEquals("Message history moves when its scroll container is swiped", messageBefore.top, messageAfter.top)
        println("MESSAGE_HEADER conversation collapsed title=$titleAfter back=$backAfter")
        captureUsabilityScreenshot(compose, "android_message_conversation_collapsed")

        repeat(3) {
            compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange))
                .performTouchInput { swipeDown() }
            compose.waitForIdle()
        }
        val titleExpanded = compose.onNodeWithText("Quiet Fox").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        assertTrue("Scrolling back expands the participant title", titleExpanded.height > titleAfter.height)
        println("MESSAGE_HEADER conversation expandedAgain title=$titleExpanded")
        captureUsabilityScreenshot(compose, "android_message_conversation_expanded_again")
        compose.onNodeWithText("View profile").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("About").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("About").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Fictional conversation note 30").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Messages").assertIsDisplayed()
    }

    private val baseUrl get() = "http://127.0.0.1:${server.localPort}"

    private fun inboxPayload(): String = (1..28).joinToString(",", "[", "]") { index ->
        """{"_id":"thread-$index","userFrom":{"_id":"member-$index","username":"traveller-$index","displayName":"Traveller $index"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"Fictional message $index"},"read":true}"""
    }

    private fun conversationPayload(): String = (1..30).joinToString(",", "[", "]") { index ->
        """{"_id":"message-$index","content":"Fictional conversation note $index","userFrom":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}"""
    }

    private fun startResponder(responseFor: (String) -> Pair<String, String>) {
        responder = thread(isDaemon = true, name = "message-header-baseline-api") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                socket.use { connection ->
                    connection.soTimeout = 1_000
                    val input = connection.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (input.readLine()?.isNotEmpty() == true) Unit
                    val (status, body) = responseFor(request)
                    val bytes = body.toByteArray(Charsets.UTF_8)
                    connection.getOutputStream().apply {
                        write(
                            "HTTP/1.1 $status\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(bytes)
                        flush()
                    }
                }
            }
        }
    }
}
