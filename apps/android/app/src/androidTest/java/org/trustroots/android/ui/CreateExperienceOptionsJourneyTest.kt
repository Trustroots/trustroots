package org.trustroots.android.ui

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
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
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class CreateExperienceOptionsJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val submittedBody = AtomicReference<String>()
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

    @Test fun recordsHostingGuestAndRecommendationChoices() {
        responder = thread(isDaemon = true) {
            val socket = acceptOrStop() ?: return@thread
            socket.use {
                val input = socket.getInputStream().bufferedReader()
                input.readLine()
                var contentLength = 0
                while (true) {
                    val header = input.readLine() ?: break
                    if (header.isEmpty()) break
                    if (header.startsWith("Content-Length:", true)) {
                        contentLength = header.substringAfter(':').trim().toInt()
                    }
                }
                val body = CharArray(contentLength)
                var offset = 0
                while (offset < body.size) {
                    val count = input.read(body, offset, body.size - offset)
                    if (count < 0) break
                    offset += count
                }
                submittedBody.set(body.concatToString(0, offset))
                val bytes = "{}".toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Menu) {
                CreateExperienceScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    memberID = "member-two",
                    memberLabel = "Quiet Fox",
                    onSessionInvalidated = {},
                    onBack = {},
                    onCreated = {},
                )
            }
        }

        val checkbox = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox)
        compose.onAllNodes(checkbox)[0].performClick()
        compose.onAllNodes(checkbox)[1].performClick()
        compose.onAllNodes(checkbox)[2].performClick()
        compose.onNodeWithText("Not sure").performClick()
        compose.onNodeWithText("Public experience (optional)")
            .performTextReplacement("  A fictional shared journey.  ")
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { !submittedBody.get().isNullOrBlank() }

        val body = JSONObject(submittedBody.get())
        val interactions = body.getJSONObject("interactions")
        assertEquals("member-two", body.getString("userTo"))
        assertFalse(interactions.getBoolean("met"))
        assertTrue(interactions.getBoolean("host"))
        assertTrue(interactions.getBoolean("guest"))
        assertEquals("unknown", body.getString("recommend"))
        assertEquals("A fictional shared journey.", body.getString("feedbackPublic"))
        responder?.join(1_000)
    }
}
