package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen

@RunWith(AndroidJUnit4::class)
class CirclesDescriptionFilterJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
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

    @Test fun searchesFormattedDescriptionsAndOpensCircleWithoutArtwork() {
        responder = thread(isDaemon = true) {
            repeat(4) {
                val socket = acceptOrStop() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    val headers = mutableListOf<String>()
                    while (true) {
                        val line = input.readLine() ?: break
                        if (line.isEmpty()) break
                        headers += line
                    }
                    val length = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                        ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                    repeat(length) { input.read() }
                    val payload = when {
                        request.startsWith("GET /api/tribes/mountain ") -> """{"_id":"circle-mountain","slug":"mountain","label":"Mountain Circle","count":7,"image":false}"""
                        request.startsWith("GET /api/tribes") -> """[
                            {"_id":"circle-harbour","slug":"harbour","label":"Harbour Circle","description":"<p>Quiet <b>sea</b> routes</p>","count":3,"image":false,"color":"not-a-colour"},
                            {"_id":"circle-mountain","slug":"mountain","label":"Mountain Circle","count":7,"image":false}
                        ]"""
                        request.startsWith("GET /api/users/memberships") -> "[]"
                        else -> "{}"
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Circles) {
                CirclesScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Harbour Circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("  SEA ")
        compose.onNodeWithText("Harbour Circle").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()

        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("")
        compose.onNodeWithText("Mountain Circle").performClick()
        compose.onNodeWithText("Mountain Circle").assertIsDisplayed()
        compose.onNodeWithText("Join circle").assertIsDisplayed()
        responder?.join(1_000)
    }
}
