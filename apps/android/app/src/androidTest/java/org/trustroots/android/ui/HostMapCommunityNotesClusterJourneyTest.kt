package org.trustroots.android.ui

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.NostrootsNotesClient

@RunWith(AndroidJUnit4::class)
class HostMapCommunityNotesClusterJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val requests = CopyOnWriteArrayList<String>()
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val mapReference = AtomicReference<MapView?>()
    private val sockets = RecordingSocketFactory()
    private val offlineMapViewFactory: (Context) -> MapView = { context ->
        MapView(context).apply {
            setUseDataConnection(false)
            mapReference.set(this)
        }
    }
    private var responder: Thread? = null

    @After fun stopFixture() {
        runCatching { compose.waitForIdle() }
        activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
        runCatching { server.close() }
        responder?.join(2_000)
        assertTrue("The local map fixture should stop after shutdown", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The local map fixture failed", it) }
    }

    @Test fun clickingACommunityNoteClusterZoomsTheMapBeforeOpeningNotes() {
        startFixture()
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=fictional-map-session", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, _ -> emptyList() },
                notesClientFactory = { onNote, onError -> NostrootsNotesClient(onNote, onError, sockets) },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(15_000) {
            requests.any { it.startsWith("GET /api/offers?") } &&
                mapReference.get()?.width?.let { it > 0 } == true
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
        connection.listener.onMessage(connection.socket, noteEvent("1", "a", "8CCGPVC6+W7"))
        connection.listener.onMessage(connection.socket, noteEvent("2", "b", "8CCGPVC6+W8"))
        connection.listener.onMessage(connection.socket, noteEvent("3", "c", "8CCGPVC6+W9"))

        compose.waitUntil(15_000) {
            requests.any { it.startsWith("GET /api/nostr/author-visibility?") } &&
                compose.onAllNodesWithText("0 offers · 3 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        val beforeZoom = currentZoom()
        val beforeBounds = requests.mapNotNull { SearchBounds.from(it) }.last()
        val requestCountBeforeZoom = requests.size
        assertTrue("The fixture should put notes near the initial map centre", beforeZoom < 14.0)
        assertTrue(beforeBounds.longitudeSpan > 0.0)
        assertTrue(requests.any { request ->
            request.startsWith("GET /api/nostr/author-visibility?") &&
                ("a".repeat(64) in request) && ("b".repeat(64) in request) && ("c".repeat(64) in request)
        })

        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(15_000) {
            currentZoom() >= beforeZoom + 1.9 &&
                requests.drop(requestCountBeforeZoom).mapNotNull { SearchBounds.from(it) }
                    .any { it.longitudeSpan < beforeBounds.longitudeSpan * 0.75 }
        }

        assertTrue("The clustered-note marker should zoom the MapView by about two levels", currentZoom() >= beforeZoom + 1.9)
        assertTrue(
            "Zooming the note cluster should search a smaller visible area",
            requests.drop(requestCountBeforeZoom).mapNotNull { SearchBounds.from(it) }
                .any { it.longitudeSpan < beforeBounds.longitudeSpan * 0.75 },
        )
        assertTrue(compose.onAllNodesWithText("Community notes via Nostroots").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithTag("mapStatistics").assertIsDisplayed()

        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { connection.socket.closes.isNotEmpty() }
    }

    private fun currentZoom(): Double {
        var zoom = 0.0
        compose.runOnUiThread { zoom = requireNotNull(mapReference.get()).zoomLevelDouble }
        return zoom
    }

    private fun startFixture() {
        responder = thread(isDaemon = true, name = "community-note-cluster-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread
                    responderFailure.compareAndSet(null, error)
                    return@thread
                } catch (error: IOException) {
                    if (!server.isClosed) responderFailure.compareAndSet(null, error)
                    return@thread
                }

                activeSocket.set(socket)
                try {
                    socket.soTimeout = 10_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader(Charsets.US_ASCII)
                        val request = input.readLine() ?: throw IOException("Missing request line")
                        while (true) {
                            val header = input.readLine() ?: throw IOException("Incomplete request headers")
                            if (header.isEmpty()) break
                        }
                        requests += request
                        val payload = if (request.startsWith("GET /api/offers?")) {
                            """{"features":[]}"""
                        } else if (request.startsWith("GET /api/nostr/author-visibility?")) {
                            """{"linkedPubkeys":[],"pubkeys":[]}"""
                        } else {
                            "{}"
                        }
                        val body = payload.toByteArray(Charsets.UTF_8)
                        val output = connection.getOutputStream()
                        output.write(
                            (
                                "HTTP/1.1 200 OK\r\n" +
                                    "Content-Type: application/json; charset=utf-8\r\n" +
                                    "Content-Length: ${body.size}\r\n" +
                                    "Connection: close\r\n\r\n"
                                ).toByteArray(Charsets.US_ASCII),
                        )
                        output.write(body)
                        output.flush()
                    }
                } catch (_: SocketException) {
                    // A client can cancel an in-flight search as the map moves.
                } catch (error: IOException) {
                    responderFailure.compareAndSet(null, error)
                } catch (error: Throwable) {
                    responderFailure.compareAndSet(null, error)
                } finally {
                    activeSocket.compareAndSet(socket, null)
                    runCatching { socket.close() }
                }
            }
        }
    }

    private fun noteEvent(idDigit: String, author: String, locationCode: String): String =
        """["EVENT","map",{"id":"${idDigit.repeat(64)}","pubkey":"${author.repeat(64)}","sig":"${"d".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A fictional map gathering $idDigit","tags":[["l","$locationCode","open-location-code"]]}]"""

    private data class SearchBounds(
        val south: Double,
        val west: Double,
        val north: Double,
        val east: Double,
    ) {
        val longitudeSpan get() = east - west

        companion object {
            fun from(request: String): SearchBounds? {
                if (!request.startsWith("GET /api/offers?")) return null
                fun value(name: String) = Regex("(?:[?&])$name=([^& ]+)").find(request)?.groupValues?.get(1)?.toDoubleOrNull()
                val south = value("southWestLat") ?: return null
                val west = value("southWestLng") ?: return null
                val north = value("northEastLat") ?: return null
                val east = value("northEastLng") ?: return null
                return SearchBounds(south, west, north, east)
            }
        }
    }

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
}
