package org.trustroots.android.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
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
class HostMapJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun loadsHostsForVisibleMapArea() {
        val responder = thread {
            server.accept().use { socket ->
                val input = socket.getInputStream().bufferedReader()
                val request = input.readLine()
                while (!input.readLine().isNullOrEmpty()) Unit
                check(request.contains("/api/offers?"))
                val payload = """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
                val bytes = payload.toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
            }
        }
        compose.setContent {
            SearchHubScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
            )
        }
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offers · 0 Nostroots notes").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Hosts map").assertIsDisplayed()
        compose.onNodeWithText("Members").assertIsDisplayed()
        val tabsBottom = compose.onNodeWithTag("map-tabs").fetchSemanticsNode().boundsInRoot.bottom
        val controlsTop = compose.onNodeWithTag("map-controls").fetchSemanticsNode().boundsInRoot.top
        org.junit.Assert.assertEquals(tabsBottom, controlsTop, 1f)
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithText("Meet").assertIsDisplayed()
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        compose.onNodeWithText("Last active: any time").performClick()
        compose.onNodeWithText("Last active: 1 month").assertIsDisplayed()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithText("Find members").assertIsDisplayed()
        responder.join(1_000)
    }
}
