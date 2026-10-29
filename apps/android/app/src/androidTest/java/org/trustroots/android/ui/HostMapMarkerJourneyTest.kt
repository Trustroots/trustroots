package org.trustroots.android.ui

import android.graphics.Point
import android.graphics.drawable.BitmapDrawable
import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.geometry.Offset
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapNotesConnection
import org.trustroots.android.ui.search.SearchHubScreen

@RunWith(AndroidJUnit4::class)
class HostMapMarkerJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @After fun closeServer() {
        server.close()
        activeSocket?.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    private fun startHostFixture() {
        responder = thread(isDaemon = true) {
            while (true) {
                val socket = acceptOrStop() ?: return@thread
                activeSocket = socket
                try {
                    socket.use {
                        socket.soTimeout = 5_000
                        val input = socket.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        requests += request
                        val headers = mutableListOf<String>()
                        while (true) {
                            val header = input.readLine() ?: break
                            if (header.isEmpty()) break
                            headers += header
                        }
                        val contentLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                            ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                        repeat(contentLength) {
                            if (input.read() < 0) throw java.io.EOFException("Incomplete fixture body")
                        }
                        val payload = when {
                            request.startsWith("GET /api/nostr/author-visibility?") ->
                                """{"linkedPubkeys":[],"pubkeys":[]}"""
                            request.startsWith("GET /api/offers?") ->
                            """{"features":[{"properties":{"id":"offer-one","type":"host","status":"maybe"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
                            request.startsWith("GET /api/offers/offer-one") ->
                                """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","maxGuests":2,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
                            request.startsWith("GET /api/users/quiet-fox") ->
                                """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A fictional host"}"""
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
                } catch (error: java.io.IOException) {
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    @Test fun opensHostDetailsFromTheVisibleMapMarker() {
        startHostFixture()
        lateinit var mapView: MapView
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    geocoderLookup = { _, _, _ ->
                        listOf(Address(Locale.UK).apply {
                            latitude = 38.7223
                            longitude = -9.1393
                            setAddressLine(0, "Fictional destination")
                        })
                    },
                    mapViewFactory = { context -> MapView(context).also { mapView = it } },
                )
            }
        }

        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offer · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.runOnUiThread {
            val marker = mapView.overlays.filterIsInstance<Marker>().single { it.title == "Potential host" }
            val bitmap = (marker.icon as BitmapDrawable).bitmap
            val expectedMaybeColour = mapView.resources.getColor(
                org.trustroots.android.R.color.map_marker_maybe,
                mapView.context.theme,
            )
            assertEquals(expectedMaybeColour, bitmap.getPixel(bitmap.width / 2, bitmap.height / 2))
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        check(requests.any { it.startsWith("GET /api/offers/offer-one ") })

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("hostDetailRoute", useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional spare room.").fetchSemanticsNodes().isNotEmpty()
        }

        val offerSearchesBeforePan = requests.count { it.startsWith("GET /api/offers?") }
        compose.onNodeWithTag("hostMapView").performTouchInput {
            val start = Offset(width * 0.75f, height * 0.32f)
            val end = Offset(width * 0.50f, height * 0.32f)
            down(0, start)
            for (step in 1..8) {
                val fraction = step / 8f
                moveTo(0, Offset(start.x + (end.x - start.x) * fraction, start.y), 50)
            }
            up(0)
        }
        compose.waitUntil(10_000) {
            requests.count { it.startsWith("GET /api/offers?") } > offerSearchesBeforePan
        }
        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()

        val offerSearchCount = requests.count { it.startsWith("GET /api/offers?") }
        compose.onNodeWithText("Quiet Fox").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("profilePager").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("hostDetailRoute", useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithTag("hostDetailRoute", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("hostResultCard").assertDoesNotExist()
        compose.onNodeWithTag("profilePager").assertIsDisplayed()
        compose.onNodeWithTag("profilePager").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("profilePager").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithTag("hostResultCard").assertDoesNotExist()
        compose.onNodeWithText("A fictional spare room.").assertDoesNotExist()
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
        check(requests.count { it.startsWith("GET /api/offers?") } == offerSearchCount)

        // The same marker can be opened again, and closing its preview keeps the map usable.
        val (markerPosition, mapSize) = compose.runOnUiThread {
            Point().also { mapView.projection.toPixels(GeoPoint(38.7223, -9.1393), it) } to
                (mapView.width to mapView.height)
        }
        assertTrue(
            "The original map marker should remain visible after the pan",
            markerPosition.x in 0 until mapSize.first && markerPosition.y in 0 until mapSize.second,
        )
        compose.onNodeWithTag("hostMapView").performTouchInput {
            click(Offset(markerPosition.x.toFloat(), markerPosition.y.toFloat()))
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional spare room.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Close host result").performClick()
        compose.onNodeWithText("A fictional spare room.").assertDoesNotExist()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Hosting").assertDoesNotExist()

        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional")
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Fictional destination").fetchSemanticsNodes().isNotEmpty()
        }
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Fictional destination").assertDoesNotExist()
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
    }

    @Test fun detailAndProfileRoutesKeepTheMapAndItsNotesConnectionAlive() {
        startHostFixture()
        val openedNotesConnections = AtomicInteger()
        val closedNotesConnections = AtomicInteger()
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    geocoderLookup = { _, _, _ -> emptyList() },
                    notesClientFactory = { _, _ ->
                        openedNotesConnections.incrementAndGet()
                        HostMapNotesConnection { closedNotesConnections.incrementAndGet() }
                    },
                )
            }
        }

        val oneOfferMapStatistics = compose.activity.getString(
            org.trustroots.android.R.string.screen_map_statistics,
            compose.activity.resources.getQuantityString(org.trustroots.android.R.plurals.screen_offers_count, 1, 1),
            compose.activity.resources.getQuantityString(org.trustroots.android.R.plurals.screen_nostroots_notes_count, 0, 0),
        )
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText(oneOfferMapStatistics).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()
        try {
            compose.waitUntil(10_000) {
                openedNotesConnections.get() == 1 && requests.count { it.startsWith("GET /api/offers?") } >= 2
            }
        } catch (failure: androidx.compose.ui.test.ComposeTimeoutException) {
            compose.onRoot().printToLog("SearchRetention")
            throw AssertionError(
                "Timed out waiting for map retention setup: " +
                    "openedNotesConnections=${openedNotesConnections.get()}, " +
                    "closedNotesConnections=${closedNotesConnections.get()}, " +
                    "offerSearchRequests=${requests.count { it.startsWith("GET /api/offers?") }}, " +
                    "requests=${requests.joinToString(" | ")}",
                failure,
            )
        }
        val mapSearches = requests.count { it.startsWith("GET /api/offers?") }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional spare room.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Fox").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("profilePager").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("hostDetailRoute", useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithTag("hostDetailRoute", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("navigation-search").assertIsDisplayed()
        compose.onNodeWithTag("profilePager").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("profilePager").fetchSemanticsNodes().isEmpty()
        }
        assertEquals(1, openedNotesConnections.get())
        assertEquals(0, closedNotesConnections.get())
        assertEquals(mapSearches, requests.count { it.startsWith("GET /api/offers?") })

        compose.onNodeWithTag("hostDetailRoute", useUnmergedTree = true).assertDoesNotExist()
        compose.waitForIdle()
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
        assertEquals(1, openedNotesConnections.get())
        assertEquals(0, closedNotesConnections.get())

        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithText("Find a member").assertIsDisplayed()
        assertEquals(1, closedNotesConnections.get())
    }
}
