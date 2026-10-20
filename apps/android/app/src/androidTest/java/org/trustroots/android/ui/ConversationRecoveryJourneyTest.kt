package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.AnnotatedString
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import java.time.Instant
import java.util.concurrent.CopyOnWriteArrayList
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
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.conversation.ConversationScreen

@RunWith(AndroidJUnit4::class)
class ConversationRecoveryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0)
    private val preferences by lazy {
        context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE)
    }
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val draftKey = "messages.thread.steady-heron-quiet-fox"
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private var previousDraft: String? = null
    private var hadPreviousDraft = false
    private var responder: Thread? = null

    @org.junit.Before fun saveAndClearDraft() {
        hadPreviousDraft = preferences.contains(draftKey)
        previousDraft = preferences.getString(draftKey, null)
        preferences.edit().remove(draftKey).commit()
    }

    @After fun restoreDraftAndCloseServer() {
        server.close()
        responder?.join(1_000)
        if (hadPreviousDraft) {
            preferences.edit().putString(draftKey, previousDraft).commit()
        } else {
            preferences.edit().remove(draftKey).commit()
        }
    }

    @Test fun failedMessageSendKeepsDraftForRetryAndSuccessfulSendClearsIt() {
        val draft = "A thoughtful reply."
        preferences.edit().putString(draftKey, draft).commit()
        startResponder()
        compose.setContent {
            TrustrootsTheme {
                ConversationScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    member = MessageMember("member-one", "quiet-fox", "Quiet Fox"),
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A note from a neighbour.").fetchSemanticsNodes().isNotEmpty()
        }
        assertComposerText(draft)
        compose.onNodeWithContentDescription("Send").assertIsDisplayed().assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Local message could not be sent.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Local message could not be sent.").assertIsDisplayed()
        assertComposerText(draft)
        assertEquals(draft, preferences.getString(draftKey, null))
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithContentDescription("Send").assertIsEnabled() }.isSuccess
        }

        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) {
            requests.count { it.requestLine.startsWith("POST /api/messages ") } == 2 &&
                compose.onAllNodesWithText(draft).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText(draft).assertIsDisplayed()
        compose.onNodeWithText("Local message could not be sent.").assertDoesNotExist()
        assertComposerText("")
        assertFalse(preferences.contains(draftKey))

        val posted = requests.filter { it.requestLine.startsWith("POST /api/messages ") }
        assertEquals(2, posted.size)
        posted.forEach {
            val body = JSONObject(it.body)
            assertEquals("member-one", body.getString("userTo"))
            assertEquals(draft, body.getString("content"))
        }
        responder?.let { thread ->
            server.close()
            thread.join(1_000)
            assertTrue("The local conversation responder should stop after server shutdown", !thread.isAlive)
        }
    }

    private fun startResponder() {
        responder = thread(isDaemon = true) {
            var sendAttempts = 0
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val requestLine = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine().orEmpty()
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    val bodyBuffer = CharArray(contentLength)
                    var bodyOffset = 0
                    while (bodyOffset < bodyBuffer.size) {
                        val count = input.read(bodyBuffer, bodyOffset, bodyBuffer.size - bodyOffset)
                        if (count < 0) break
                        bodyOffset += count
                    }
                    val body = bodyBuffer.concatToString()
                    requests += CapturedRequest(requestLine, body)
                    val response = when {
                        requestLine.contains("/avatar?") -> FixtureResponse("404 Not Found", "")
                        requestLine.startsWith("GET /api/messages/member-one?") -> FixtureResponse(
                            "200 OK",
                            """[{"_id":"message-in","content":"<p>A note from a neighbour.</p>","created":"${Instant.parse("2025-02-03T04:05:06Z")}","userFrom":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                        )
                        requestLine.startsWith("POST /api/messages ") -> {
                            sendAttempts++
                            if (sendAttempts == 1) {
                                FixtureResponse("500 Internal Server Error", """{"message":"Local message could not be sent."}""")
                            } else {
                                FixtureResponse(
                                    "200 OK",
                                    """{"_id":"message-out","content":${JSONObject.quote(draftContent(body))},"created":"${Instant.now()}","userFrom":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}}""",
                                )
                            }
                        }
                        else -> FixtureResponse("404 Not Found", "")
                    }
                    val bytes = response.body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 ${response.status}\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
    }

    private fun draftContent(body: String): String = JSONObject(body).getString("content")

    private fun assertComposerText(expected: String) {
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(expected)),
        )
    }

    private data class CapturedRequest(val requestLine: String, val body: String)
    private data class FixtureResponse(val status: String, val body: String)
}
