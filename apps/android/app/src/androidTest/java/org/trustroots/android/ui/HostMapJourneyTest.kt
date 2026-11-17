package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
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
import org.trustroots.android.ui.hostmap.HostMapScreen
import org.trustroots.android.ui.search.SearchHubScreen

@RunWith(AndroidJUnit4::class)
class HostMapJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    private var initialFixture: LocalTransportFixture? = null
    @After fun closeServer() { initialFixture?.close(); server.close() }

    @Test fun loadsHostsForVisibleMapArea() {
        val local = LocalTransportFixture { request ->
            if (request.path.startsWith("/api/offers?")) LocalTransportFixture.Response(
                """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}""",
            ) else LocalTransportFixture.Response("[]")
        }
        initialFixture = local
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offer · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
        compose.onNodeWithTag("mapStatistics").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_host_map")
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithTag("openFilters").assertIsDisplayed()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithText("Meet").assertIsDisplayed()
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        compose.onNodeWithText("Last active: any time").performClick()
        compose.onNodeWithText("Last active: 1 month").assertIsDisplayed()
        compose.onNodeWithText("Spoken languages").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_host_map_wrapped_filters")
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Back to map").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithText("Find a member").assertIsDisplayed()
        compose.onNodeWithText("Switch to map search").performClick()
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
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
        compose.onNodeWithTag("openFilters").assertIsDisplayed()
        compose.onNodeWithText("All circles").performClick()
        compose.onNodeWithTag("circleFilterOption-all").assertIsSelected()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Circle").performClick()
        compose.onNodeWithText("Wanderers").performClick()
        compose.onNodeWithTag("circleFilterOption-circle-two").assertIsSelected()
        compose.onNodeWithTag("circleFilterOption-circle-one").assertIsSelected()
        compose.waitUntil(15_000) {
            offerFilters.any { it.contains("\"tribes\":[\"circle-one\",\"circle-two\"]") }
        }
        assertTrue(offerFilters.any { it.contains("\"tribes\":[\"circle-one\",\"circle-two\"]") })
    }
}
