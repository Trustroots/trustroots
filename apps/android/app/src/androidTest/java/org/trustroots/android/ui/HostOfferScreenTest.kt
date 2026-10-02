package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostOfferScreenTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun loadsExistingHostingOffer() {
        thread(isDaemon = true) {
            repeat(6) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
                        request.contains("/api/offers-by/") ->
                            """[{"_id":"offer-one","status":"yes","description":"<p>Spare sofa</p>","maxGuests":2,"showOnlyInMyCircles":false,"location":[48.69,9.14]}]"""
                        request.contains("/api/users/") ->
                            """{"_id":"member-one","username":"river-otter","displayName":"River Otter"}"""
                        else -> "{}"
                    }
                    val body = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(body)
                }
            }
        }
        compose.setContent {
            HostOfferScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                onSessionInvalidated = {},
                onBack = {},
            )
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Spare sofa").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Host").assertIsDisplayed()
        compose.onNodeWithText("Spare sofa").assertIsDisplayed()
        compose.onNodeWithText("Save and exit").assertIsDisplayed()
    }
}
