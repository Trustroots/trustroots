package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.atomic.AtomicInteger
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
class CirclesMembershipRetryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val membershipUpdates = AtomicInteger()
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

    @Test fun failedMembershipChangeCanBeRetriedAndPersistsInList() {
        responder = thread(isDaemon = true) {
            repeat(6) { _ ->
                val socket = acceptOrStop() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val isUpdate = request.contains("/api/users/memberships/circle-one")
                    if (isUpdate) membershipUpdates.incrementAndGet()
                    val status = if (isUpdate && membershipUpdates.get() == 1) "500 Internal Server Error" else "200 OK"
                    val payload = when {
                        isUpdate && membershipUpdates.get() == 1 -> """{"message":"Local membership update failed."}"""
                        request.startsWith("GET /api/tribes/wanderers ") -> """{"_id":"circle-one","slug":"wanderers","label":"Wanderers","count":2,"description":"A local circle"}"""
                        request.startsWith("GET /api/tribes?limit=150 ") -> """[{"_id":"circle-one","slug":"wanderers","label":"Wanderers","count":2,"description":"A local circle"}]"""
                        else -> "[]"
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
            NativeTestAppFrame(Destination.Circles) {
                CirclesScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }

        compose.waitUntil(10_000) { compose.onAllNodesWithText("Wanderers").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Wanderers").performClick()
        compose.onNodeWithText("Join circle").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Local membership update failed.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Local membership update failed.").assertIsDisplayed()
        compose.onNodeWithText("Join circle").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Leave circle").fetchSemanticsNodes().isNotEmpty() }
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithText("Joined").assertIsDisplayed()
        check(membershipUpdates.get() == 2)
        responder?.join(1_000)
    }
}
