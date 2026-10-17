package org.trustroots.android.ui

import android.content.Context
import android.graphics.Point
import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.api.decodeOpenLocationCode

@RunWith(AndroidJUnit4::class)
class HostMapHighZoomCommunityNotesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null
    private val sockets = RecordingSocketFactory()
    private val mapReference = AtomicReference<MapView?>()
    private val geocoderCalls = CopyOnWriteArrayList<String>()

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun clusteredNotesSeparateAtHighZoomAndOpenWithoutFurtherZoom() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response("{\"features\":[]}")
                request.method == "GET" && request.path.startsWith("/api/nostr/author-visibility?") ->
                    LocalTransportFixture.Response(
                        "{\"linkedPubkeys\":[],\"pubkeys\":[\"${AUTHOR_A}\",\"${AUTHOR_B}\",\"${AUTHOR_C}\"]}",
                    )
                else -> LocalTransportFixture.Response("[]")
            }
        }
        fixture = local
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(SESSION_COOKIE, MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, _, _ -> emptyList() },
                notesClientFactory = { onNote, onError -> NostrootsNotesClient(onNote, onError, sockets) },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(10_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { sockets.connections.size == 1 }
        val connection = sockets.connections.single()
        connection.listener.onOpen(
            connection.socket,
            Response.Builder().request(connection.socket.request()).protocol(Protocol.HTTP_1_1)
                .code(101).message("Switching Protocols").build(),
        )
        connection.listener.onMessage(connection.socket, noteEvent("1", AUTHOR_A, "8CCGPVC6+W7"))
        connection.listener.onMessage(connection.socket, noteEvent("2", AUTHOR_B, "8CCGPVC6+W8"))
        connection.listener.onMessage(connection.socket, noteEvent("3", AUTHOR_C, "8CCGPVC6+W9"))

        compose.waitUntil(15_000) {
            local.requests.any { it.path.startsWith("/api/nostr/author-visibility?") } &&
                compose.onAllNodesWithText("0 offers · 3 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        val groupedMarker = AtomicReference<Marker?>()
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            groupedMarker.set(map.overlays.filterIsInstance<Marker>().firstOrNull { it.title == "3 community notes" })
        }
        val initialCluster = requireNotNull(groupedMarker.get()) { "Expected one cluster marker for the three notes" }
        assertTrue("The fixture starts below the individual-marker zoom threshold", currentZoom() < 14.0)

        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            map.controller.setCenter(initialCluster.position)
            map.controller.setZoom(13.0)
        }
        compose.waitUntil(10_000) {
            val updatedCluster = AtomicReference<Marker?>(null)
            compose.runOnUiThread {
                val map = requireNotNull(mapReference.get())
                updatedCluster.set(map.overlays.filterIsInstance<Marker>().firstOrNull { it.title == "3 community notes" })
            }
            currentZoom() in 12.9..13.1 && updatedCluster.get()?.let { it !== initialCluster } == true
        }
        val clusterTouch = AtomicReference<Offset?>(null)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val marker = map.overlays.filterIsInstance<Marker>().first { it.title == "3 community notes" }
            val point = map.projection.toPixels(marker.position, Point())
            clusterTouch.set(Offset(point.x.toFloat(), point.y.toFloat()))
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(requireNotNull(clusterTouch.get())) }
        compose.waitUntil(10_000) {
            val markerCount = AtomicReference(0)
            compose.runOnUiThread {
                markerCount.set(
                    requireNotNull(mapReference.get()).overlays.filterIsInstance<Marker>()
                        .count { it.title == "Community note" },
                )
            }
            currentZoom() >= 14.9 && markerCount.get() == 3
        }

        val markerZoom = currentZoom()
        assertTrue("Tapping the actual cluster marker at zoom 13 should zoom above the threshold", markerZoom >= 14.9)
        val expectedNotes = listOf("W7", "W8", "W9").mapIndexed { index, suffix ->
            val coordinates = requireNotNull(decodeOpenLocationCode("8CCGPVC6+$suffix"))
            "A fictional map gathering ${index + 1}" to
                org.osmdroid.util.GeoPoint(coordinates.first, coordinates.second)
        }
        val topmostNoteMarker = AtomicReference<Marker?>()
        val expectedTopmostNote = AtomicReference<String?>()
        compose.runOnUiThread {
            val markers = requireNotNull(mapReference.get()).overlays.filterIsInstance<Marker>()
                .filter { it.title == "Community note" }
            val topmost = markers.last()
            val matchingNote = expectedNotes.minBy { (_, point) -> topmost.position.distanceToAsDouble(point) }
            assertTrue("The topmost marker must match one of the fictional note coordinates", topmost.position.distanceToAsDouble(matchingNote.second) < 1.0)
            topmostNoteMarker.set(topmost)
            expectedTopmostNote.set(matchingNote.first)
        }
        val markerZoomBeforeTap = AtomicReference(0.0)
        val markerTapped = AtomicReference(false)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val marker = requireNotNull(topmostNoteMarker.get())
            markerZoomBeforeTap.set(map.zoomLevelDouble)
            val point = map.projection.toPixels(marker.position, Point())
            val eventTime = android.os.SystemClock.uptimeMillis()
            val event = android.view.MotionEvent.obtain(
                eventTime,
                eventTime,
                android.view.MotionEvent.ACTION_UP,
                point.x.toFloat(),
                point.y.toFloat(),
                0,
            )
            try {
                markerTapped.set(map.overlayManager.onSingleTapConfirmed(event, map))
            } finally {
                event.recycle()
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(requireNotNull(expectedTopmostNote.get())).fetchSemanticsNodes().isNotEmpty()
        }

        assertTrue("The selected individual note marker should receive the tap", markerTapped.get())
        compose.onNodeWithText(requireNotNull(expectedTopmostNote.get())).assertIsDisplayed()
        assertEquals("Opening an individual note should not zoom again", markerZoomBeforeTap.get(), currentZoom(), 0.1)
        assertEquals(markerZoom, markerZoomBeforeTap.get(), 0.1)
        assertTrue(local.requests.any { it.method == "GET" && it.path.startsWith("/api/nostr/author-visibility?") })
    }

    @Test fun groupedMarkerTappedAtHighZoomOpensEveryNoteBeforeMarkerRefresh() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response("{\"features\":[]}")
                request.method == "GET" && request.path.startsWith("/api/nostr/author-visibility?") ->
                    LocalTransportFixture.Response(
                        "{\"linkedPubkeys\":[],\"pubkeys\":[\"$AUTHOR_A\",\"$AUTHOR_B\",\"$AUTHOR_C\"]}",
                    )
                else -> LocalTransportFixture.Response("[]")
            }
        }
        fixture = local
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(SESSION_COOKIE, MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, _, _ -> emptyList() },
                notesClientFactory = { onNote, onError -> NostrootsNotesClient(onNote, onError, sockets) },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(10_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { sockets.connections.size == 1 }
        val connection = sockets.connections.single()
        connection.listener.onOpen(
            connection.socket,
            Response.Builder().request(connection.socket.request()).protocol(Protocol.HTTP_1_1)
                .code(101).message("Switching Protocols").build(),
        )
        connection.listener.onMessage(connection.socket, noteEvent("1", AUTHOR_A, "8CCGPVC6+W7"))
        connection.listener.onMessage(connection.socket, noteEvent("2", AUTHOR_B, "8CCGPVC6+W8"))
        connection.listener.onMessage(connection.socket, noteEvent("3", AUTHOR_C, "8CCGPVC6+W9"))
        val groupedMarkerVisible = AtomicReference(false)
        compose.waitUntil(15_000) {
            local.requests.any { it.path.startsWith("/api/nostr/author-visibility?") } &&
                compose.onAllNodesWithText("0 offers · 3 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty().also {
                        compose.runOnUiThread {
                            groupedMarkerVisible.set(
                                requireNotNull(mapReference.get()).overlays
                                    .filterIsInstance<Marker>().any { it.title == "3 community notes" },
                            )
                        }
                    } && groupedMarkerVisible.get()
        }

        val initialZoom = currentZoom()
        assertTrue("The three fictional notes should first share a low-zoom marker", initialZoom < 14.0)
        val zoomBeforeStaleTap = AtomicReference(0.0)
        val highZoomMarkerTapped = AtomicReference(false)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val groupedMarker = map.overlays.filterIsInstance<Marker>()
                .firstOrNull { it.title == "3 community notes" }
                ?: error("Expected the three notes to share a marker before zooming")

            // Zoom schedules Compose work; this uninterrupted UI-thread block taps the old marker
            // while its callback still references the grouped notes.
            map.controller.setCenter(groupedMarker.position)
            map.controller.setZoom(14.5)
            zoomBeforeStaleTap.set(map.zoomLevelDouble)
            assertTrue("The captured marker tap must occur at high zoom", zoomBeforeStaleTap.get() >= 14.0)
            val point = map.projection.toPixels(groupedMarker.position, Point())
            val eventTime = android.os.SystemClock.uptimeMillis()
            val event = android.view.MotionEvent.obtain(
                eventTime,
                eventTime,
                android.view.MotionEvent.ACTION_UP,
                point.x.toFloat(),
                point.y.toFloat(),
                0,
            )
            try {
                highZoomMarkerTapped.set(map.overlayManager.onSingleTapConfirmed(event, map))
            } finally {
                event.recycle()
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional map gathering 1").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("A fictional map gathering 2").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("A fictional map gathering 3").fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue("The real overlay manager should route the MotionEvent to the old grouped marker", highZoomMarkerTapped.get())
        compose.onNodeWithText("A fictional map gathering 1").assertIsDisplayed()
        compose.onNodeWithText("A fictional map gathering 2").assertIsDisplayed()
        compose.onNodeWithText("A fictional map gathering 3").assertIsDisplayed()
        assertEquals("Opening the grouped notes must not zoom a second time", zoomBeforeStaleTap.get(), currentZoom(), 0.1)
    }

    @Test fun geocoderProviderExceptionShowsTheNoPlaceResultWithoutCrashing() {
        val local = LocalTransportFixture { request ->
            if (request.method == "GET" && request.path.startsWith("/api/offers?")) {
                LocalTransportFixture.Response("{\"features\":[]}")
            } else {
                LocalTransportFixture.Response("[]")
            }
        }
        fixture = local
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(SESSION_COOKIE, MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, query, _ ->
                    geocoderCalls += query
                    throw IllegalStateException("Fictional geocoder service unavailable")
                },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(10_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
        compose.waitUntil(5_000) { geocoderCalls.contains("Fictional Harbour") }
        compose.onNodeWithContentDescription("Search places").performClick()
        compose.waitUntil(10_000) {
            geocoderCalls.count { it == "Fictional Harbour" } >= 2 &&
                compose.onAllNodesWithText("Could not find that place.").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Could not find that place.").assertIsDisplayed()
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
    }

    @Test fun placeSearchImeActionLooksUpLocationAndIgnoresAnEmptyQuery() {
        val geocoderLimits = CopyOnWriteArrayList<Int>()
        val local = LocalTransportFixture { request ->
            if (request.method == "GET" && request.path.startsWith("/api/offers?")) {
                LocalTransportFixture.Response("{\"features\":[]}")
            } else {
                error("Unexpected API request: ${request.method} ${request.path}")
            }
        }
        fixture = local
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(SESSION_COOKIE, MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, query, maxResults ->
                    geocoderCalls += query
                    geocoderLimits += maxResults
                    listOf(android.location.Address(java.util.Locale.US).apply {
                        latitude = 37.25
                        longitude = -8.5
                        setAddressLine(0, "Fictional Harbour")
                    })
                },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(10_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithTag("placeSearchField").performImeAction()
        compose.waitForIdle()
        assertTrue("An empty IME search must not invoke the geocoder", geocoderCalls.isEmpty())
        compose.onNodeWithText("Could not find that place.").assertDoesNotExist()

        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
        compose.onNodeWithTag("placeSearchField").performImeAction()
        compose.waitUntil(10_000) {
            geocoderLimits.contains(1) && currentZoom() in 8.9..9.1 && isCentredOnFictionalHarbour()
        }
        compose.onNodeWithText("Could not find that place.").assertDoesNotExist()
        assertTrue(geocoderCalls.contains("Fictional Harbour"))
        assertTrue("IME search must use a single-result lookup", geocoderLimits.contains(1))
        assertEquals(9.0, currentZoom(), 0.1)
        compose.runOnUiThread {
            val centre = requireNotNull(mapReference.get()).mapCenter
            assertEquals(37.25, centre.latitude, 0.001)
            assertEquals(-8.5, centre.longitude, 0.001)
        }
    }

    private val offlineMapViewFactory: (Context) -> MapView = { context ->
        MapView(context).apply {
            setUseDataConnection(false)
            mapReference.set(this)
        }
    }

    private fun currentZoom(): Double {
        var zoom = 0.0
        compose.runOnUiThread { zoom = requireNotNull(mapReference.get()).zoomLevelDouble }
        return zoom
    }

    private fun isCentredOnFictionalHarbour(): Boolean {
        var isCentred = false
        compose.runOnUiThread {
            val centre = requireNotNull(mapReference.get()).mapCenter
            isCentred = kotlin.math.abs(centre.latitude - 37.25) <= 0.001 &&
                kotlin.math.abs(centre.longitude - -8.5) <= 0.001
        }
        return isCentred
    }

    private fun noteEvent(idDigit: String, author: String, locationCode: String): String =
        """["EVENT","map",{"id":"${idDigit.repeat(64)}","pubkey":"$author","sig":"${"d".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A fictional map gathering $idDigit","tags":[["l","$locationCode","open-location-code"]]}]"""

    private class RecordingSocketFactory : WebSocket.Factory {
        val connections = CopyOnWriteArrayList<Connection>()

        override fun newWebSocket(request: Request, listener: WebSocketListener): WebSocket {
            val socket = RecordingSocket(request)
            connections += Connection(listener, socket)
            return socket
        }
    }

    private data class Connection(val listener: WebSocketListener, val socket: RecordingSocket)

    private class RecordingSocket(private val originalRequest: Request) : WebSocket {
        override fun request() = originalRequest
        override fun queueSize() = 0L
        override fun send(text: String) = true
        override fun send(bytes: ByteString) = false
        override fun close(code: Int, reason: String?) = true
        override fun cancel() = Unit
    }

    private companion object {
        const val SESSION_COOKIE = "connect.sid=fictional-high-zoom-session"
        const val AUTHOR_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        const val AUTHOR_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        const val AUTHOR_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    }
}
