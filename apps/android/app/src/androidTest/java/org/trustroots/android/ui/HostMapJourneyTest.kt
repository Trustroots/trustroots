package org.trustroots.android.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.URLDecoder
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
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
        compose.onNodeWithText("Search places").assertIsDisplayed()
        compose.onNodeWithText("Filters").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Hosting").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithTag("searchPlaces").performClick()
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
        compose.onNodeWithText("Back to map").performClick()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithText("Meet").assertIsDisplayed()
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        compose.onNodeWithText("Last active: any time").performClick()
        compose.onNodeWithText("Last active: 1 month").assertIsDisplayed()
        compose.onNodeWithText("Spoken languages").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Back to map").performClick()
        compose.onNodeWithText("Search places").assertIsDisplayed()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithText("Find members").assertIsDisplayed()
        responder.join(1_000)
    }

    @Test fun searchesWithSeveralSelectedCircles() {
        val offerFilters = CopyOnWriteArrayList<String>()
        thread(isDaemon = true) {
            while (true) {
                val connection = runCatching { server.accept() }.getOrNull() ?: break
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    if (request.contains("/api/offers?")) {
                        offerFilters += URLDecoder.decode(
                            request.substringAfter("filters=").substringBefore(' '),
                            "UTF-8",
                        )
                    }
                    val payload = if (request.contains("/api/tribes")) {
                        """[{"_id":"circle-one","slug":"wanderers","label":"Wanderers","count":2},""" +
                            """{"_id":"circle-two","slug":"quiet","label":"Quiet Circle","count":3}]"""
                    } else {
                        """{"features":[]}"""
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
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
            )
        }
        compose.waitUntil(15_000) { offerFilters.isNotEmpty() }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("All circles").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Circle").performClick()
        compose.onNodeWithText("Wanderers").performClick()
        compose.onNodeWithText("✓ Quiet Circle").assertIsDisplayed()
        compose.onNodeWithText("✓ Wanderers").assertIsDisplayed()
        compose.waitUntil(15_000) {
            offerFilters.any { it.contains("\"tribes\":[\"circle-one\",\"circle-two\"]") }
        }
        assertTrue(offerFilters.any { it.contains("\"tribes\":[\"circle-one\",\"circle-two\"]") })
    }
}
