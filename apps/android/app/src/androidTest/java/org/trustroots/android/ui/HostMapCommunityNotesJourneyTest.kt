package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
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
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.NostrootsNotesClient

@RunWith(AndroidJUnit4::class)
class HostMapCommunityNotesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<String>()
    private val sockets = RecordingSocketFactory()
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    @Test fun recoversFromRelayFailureFiltersHiddenAuthorsAndOpensVisibleNotes() {
        responder = thread(isDaemon = true) {
            try {
                while (true) {
                    val socket = acceptOrStop() ?: return@thread
                    activeSocket.set(socket)
                    socket.soTimeout = 5_000
                    try {
                        socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    requests += request
                    val headers = mutableListOf<String>()
                    while (true) {
                        val line = input.readLine() ?: break
                        if (line.isEmpty()) break
                        headers += line
                    }
                    val bodyLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                        ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                    repeat(bodyLength) {
                        if (input.read() == -1) throw IOException("Request body ended before Content-Length")
                    }
                    val payload = when {
                        request.startsWith("GET /api/nostr/author-visibility?") ->
                            """{"linkedPubkeys":["${"a".repeat(64)}"],"pubkeys":[]}"""
                        else -> """{"features":[]}"""
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                        }
                    } catch (error: IOException) {
                        if (server.isClosed) return@thread
                        throw error
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) throw error
            }
        }
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, _ -> emptyList() },
                notesClientFactory = { onNote, onError -> NostrootsNotesClient(onNote, onError, sockets) },
            )
        }

        compose.waitUntil(15_000) { requests.any { it.startsWith("GET /api/offers?") } }
        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fi")
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { sockets.connections.size == 1 }
        val failedConnection = sockets.connections[0]
        failedConnection.listener.onFailure(failedConnection.socket, IOException("Local relay interrupted"), null)
        compose.onNodeWithText("Nostroots notes are temporarily unavailable.").assertIsDisplayed()

        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { failedConnection.socket.closes.isNotEmpty() }
        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { sockets.connections.size == 2 }
        val recoveredConnection = sockets.connections[1]
        recoveredConnection.listener.onOpen(
            recoveredConnection.socket,
            Response.Builder().request(recoveredConnection.socket.request()).protocol(Protocol.HTTP_1_1)
                .code(101).message("Switching Protocols").build(),
        )
        recoveredConnection.listener.onMessage(recoveredConnection.socket, noteEvent("1", "a"))
        recoveredConnection.listener.onMessage(recoveredConnection.socket, noteEvent("2", "b"))

        compose.waitUntil(15_000) {
            requests.any { it.startsWith("GET /api/nostr/author-visibility?") } &&
                compose.onAllNodesWithText("0 offers · 1 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue(requests.any { it.startsWith("GET /api/nostr/author-visibility?") })
        assertTrue(requests.any { it.contains("pubkey=${"a".repeat(64)}") })
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithText("Community notes via Nostroots").assertIsDisplayed() }.isSuccess
        }
        compose.onNodeWithText("Community notes via Nostroots").assertIsDisplayed()
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithText("A visible fictional gathering").assertIsDisplayed() }.isSuccess
        }
        compose.onNodeWithText("A visible fictional gathering").assertIsDisplayed()
        compose.onNodeWithText("A hidden fictional gathering").assertDoesNotExist()

        compose.onNodeWithText("Close").performClick()
        compose.onNodeWithText("Community notes via Nostroots").assertDoesNotExist()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithText("Community notes via Nostroots").assertIsDisplayed(); true }.getOrDefault(false)
        }
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Community notes via Nostroots").assertDoesNotExist()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()
        compose.waitUntil(5_000) { recoveredConnection.socket.closes.isNotEmpty() }
        assertEquals(1000, recoveredConnection.socket.closes.single().first)
    }

    private fun noteEvent(idDigit: String, author: String): String =
        """["EVENT","map",{"id":"${idDigit.repeat(64)}","pubkey":"${author.repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A ${if (author == "a") "hidden" else "visible"} fictional gathering","tags":[["l","8CCGPVC6+W7","open-location-code"]]}]"""

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
