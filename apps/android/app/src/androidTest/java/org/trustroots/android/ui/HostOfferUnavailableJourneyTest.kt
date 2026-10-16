package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
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
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostOfferUnavailableJourneyTest {
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

    @Test fun savesReasonsAndCircleRestrictionWhenUnavailableForHosting() {
        responder = thread(isDaemon = true) {
            repeat(3) {
                val socket = acceptOrStop() ?: return@thread
                socket.use {
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
                    val body = CharArray(contentLength)
                    var offset = 0
                    while (offset < body.size) {
                        val count = input.read(body, offset, body.size - offset)
                        if (count < 0) break
                        offset += count
                    }
                    if (request.startsWith("PUT ")) submittedBody.set(body.concatToString(0, offset))
                    val payload = when {
                        request.startsWith("GET /api/users/") ->
                            """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}"""
                        request.startsWith("GET /api/offers-by/") ->
                            """[{"_id":"offer-one","status":"no","noOfferDescription":"Away this month","showOnlyInMyCircles":false}]"""
                        else ->
                            """{"_id":"offer-one","status":"no","noOfferDescription":"Taking a break","showOnlyInMyCircles":true}"""
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
            HostOfferScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Away this month").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Why you are not hosting").performTextReplacement("Taking a break")
        val circlesRestriction = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox) and
            SemanticsMatcher.keyIsDefined(SemanticsProperties.ToggleableState)
        compose.onNode(circlesRestriction).performClick()
        compose.onNodeWithText("Save changes").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Hosting offer saved.").assertIsDisplayed()
        compose.waitUntil(5_000) { !submittedBody.get().isNullOrBlank() }

        val body = JSONObject(submittedBody.get())
        assertEquals("no", body.getString("status"))
        assertEquals("Taking a break", body.getString("noOfferDescription"))
        assertTrue(body.getBoolean("showOnlyInMyCircles"))
    }

    @Test fun showsAnErrorWhenTheMemberProfileHasNoIdentifier() {
        responder = thread(isDaemon = true) {
            val socket = acceptOrStop() ?: return@thread
            socket.use {
                val input = socket.getInputStream().bufferedReader()
                input.readLine()
                while (input.readLine()?.isNotEmpty() == true) Unit
                val payload = """{"username":"steady-heron","displayName":"Steady Heron"}"""
                val bytes = payload.toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
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

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Could not load hosting offer.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Could not load hosting offer.").assertIsDisplayed()
        responder?.join(1_000)
    }
}
