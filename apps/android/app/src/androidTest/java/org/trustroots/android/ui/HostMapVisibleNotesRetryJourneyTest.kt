package org.trustroots.android.ui

import android.content.Context
import android.graphics.Point
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
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
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.api.decodeOpenLocationCode
import org.trustroots.android.ui.hostmap.HostMapScreen

@RunWith(AndroidJUnit4::class)
class HostMapVisibleNotesRetryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val visibilityAttempts = AtomicInteger()
    private val visibilityStatuses = CopyOnWriteArrayList<Int>()
    private val sockets = RecordingSocketFactory()
    private val mapReference = AtomicReference<MapView?>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun notesFromPreviouslyVisibleAuthorRemainAvailableAfterTemporaryLookupFailure() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response("{\"features\":[]}")
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path.startsWith("/api/nostr/author-visibility?") -> {
                    when (visibilityAttempts.incrementAndGet()) {
                        1 -> LocalTransportFixture.Response("{\"linkedPubkeys\":[],\"pubkeys\":[]}")
                            .also { visibilityStatuses += it.status }
                        2 -> LocalTransportFixture.Response(
                            "{\"message\":\"Temporary visibility service issue.\"}",
                            status = 503,
                        ).also { visibilityStatuses += it.status }
                        else -> error("Unexpected extra author-visibility lookup: ${request.path}")
                    }
                }
                else -> LocalTransportFixture.Response("[]", status = 404)
            }
        }
        fixture = local
        val session = MemberSession(
            SESSION_COOKIE,
            MobileMember("steady-heron", "Steady Heron"),
        )

        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = session,
                onSessionInvalidated = {},
                geocoderLookup = { _, _, _ -> emptyList() },
                notesClientFactory = { onNote, onError -> NostrootsNotesClient(onNote, onError, sockets) },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.method == "GET" && it.path.startsWith("/api/offers?") } &&
                mapReference.get()?.width?.let { it > 0 } == true
        }
        val firstPoint = pointFor(FIRST_LOCATION)
        val secondPoint = pointFor(SECOND_LOCATION)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            map.controller.setCenter(
                GeoPoint(
                    (firstPoint.latitude + secondPoint.latitude) / 2,
                    (firstPoint.longitude + secondPoint.longitude) / 2,
                ),
            )
            map.controller.setZoom(12.5)
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { sockets.connections.size == 1 }
        val connection = sockets.connections.single()
        connection.listener.onOpen(
            connection.socket,
            Response.Builder().request(connection.socket.request()).protocol(Protocol.HTTP_1_1)
                .code(101).message("Switching Protocols").build(),
        )

        connection.listener.onMessage(connection.socket, noteEvent("1", FIRST_LOCATION, FIRST_CONTENT))
        awaitVisibleNotes(local, noteCount = 1, lookupCount = 1)
        waitForMarkerCount(1)
        tapNoteMarker(FIRST_LOCATION)
        waitForNote(FIRST_CONTENT)
        compose.onNodeWithText(FIRST_CONTENT).assertIsDisplayed()
        compose.onNodeWithText("Close").performClick()

        connection.listener.onMessage(connection.socket, noteEvent("2", SECOND_LOCATION, SECOND_CONTENT))
        awaitVisibleNotes(local, noteCount = 2, lookupCount = 2)
        waitForMarkerCount(2)
        tapNoteMarker(FIRST_LOCATION)
        waitForNote(FIRST_CONTENT)
        compose.onNodeWithText(FIRST_CONTENT).assertIsDisplayed()
        compose.onNodeWithText("Close").performClick()
        tapNoteMarker(SECOND_LOCATION)
        waitForNote(SECOND_CONTENT)
        compose.onNodeWithText(SECOND_CONTENT).assertIsDisplayed()
        compose.onNodeWithText("Close").performClick()

        val lookups = local.requests.filter { it.path.startsWith("/api/nostr/author-visibility?") }
        assertEquals(2, visibilityAttempts.get())
        assertEquals(2, lookups.size)
        assertTrue(lookups.all { it.path.contains("pubkey=$AUTHOR_A") })
        assertTrue(lookups.all { it.cookie == SESSION_COOKIE })
        assertEquals(listOf(200, 503), visibilityStatuses.toList())

        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { connection.socket.closes.isNotEmpty() }
        assertEquals(1000, connection.socket.closes.single().first)
    }

    private fun awaitVisibleNotes(local: LocalTransportFixture, noteCount: Int, lookupCount: Int) {
        compose.waitUntil(15_000) {
            local.requests.count { it.path.startsWith("/api/nostr/author-visibility?") } >= lookupCount &&
                compose.onAllNodesWithText("0 offers · $noteCount Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("0 offers · $noteCount Nostroots notes in this area").assertIsDisplayed()
    }

    private fun waitForMarkerCount(expected: Int) {
        compose.waitUntil(10_000) {
            val count = AtomicInteger(-1)
            compose.runOnUiThread {
                count.set(
                    requireNotNull(mapReference.get()).overlays.filterIsInstance<Marker>()
                        .count { it.title == "Community note" },
                )
            }
            count.get() == expected
        }
    }

    private fun waitForNote(content: String) {
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText(content).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun tapNoteMarker(locationCode: String) {
        val tapped = AtomicReference(false)
        val target = pointFor(locationCode)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val marker = map.overlays.filterIsInstance<Marker>()
                .filter { it.title == "Community note" }
                .minBy { it.position.distanceToAsDouble(target) }
            val pixel = map.projection.toPixels(marker.position, Point())
            assertTrue("The selected note marker should be on the visible map", pixel.x in 0 until map.width && pixel.y in 0 until map.height)
            val now = android.os.SystemClock.uptimeMillis()
            val event = MotionEvent.obtain(now, now, MotionEvent.ACTION_UP, pixel.x.toFloat(), pixel.y.toFloat(), 0)
            try {
                tapped.set(map.overlayManager.onSingleTapConfirmed(event, map))
            } finally {
                event.recycle()
            }
        }
        assertTrue("The note marker should accept a tap", tapped.get())
    }

    private fun pointFor(code: String): GeoPoint {
        val coordinates = requireNotNull(decodeOpenLocationCode(code))
        return GeoPoint(coordinates.first, coordinates.second)
    }

    private val offlineMapViewFactory: (Context) -> MapView = { context ->
        MapView(context).apply {
            setUseDataConnection(false)
            mapReference.set(this)
        }
    }

    private fun noteEvent(idDigit: String, locationCode: String, content: String): String =
        """["EVENT","map",{"id":"${idDigit.repeat(64)}","pubkey":"$AUTHOR_A","sig":"${"d".repeat(128)}","kind":30397,"created_at":1700000000,"content":"$content","tags":[["l","$locationCode","open-location-code"]]}]"""

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
        val closes = CopyOnWriteArrayList<Pair<Int, String?>>()
        override fun request() = originalRequest
        override fun queueSize() = 0L
        override fun send(text: String) = true
        override fun send(bytes: ByteString) = false
        override fun close(code: Int, reason: String?): Boolean { closes += code to reason; return true }
        override fun cancel() = Unit
    }

    private companion object {
        const val SESSION_COOKIE = "connect.sid=fictional-visible-notes-session"
        const val AUTHOR_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        const val FIRST_LOCATION = "8CCGPVC6+W7"
        const val SECOND_LOCATION = "8CCGQVC6+W7"
        const val FIRST_CONTENT = "A fictional visible note from the same author."
        const val SECOND_CONTENT = "A second fictional visible note from that author."
    }
}
