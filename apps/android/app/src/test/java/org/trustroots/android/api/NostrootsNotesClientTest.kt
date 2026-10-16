package org.trustroots.android.api

import java.io.IOException
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NostrootsNotesClientTest {
    @Test fun subscribesToMapNotesAndDeliversOnlyValidEvents() {
        val notes = mutableListOf<CommunityNote>()
        val factory = RecordingSocketFactory()
        val client = NostrootsNotesClient(notes::add, { error("Unexpected relay failure") }, factory)
        val socket = factory.socket
        assertEquals("relay.trustroots.org", socket.request().url.host)
        assertTrue(socket.request().url.isHttps)
        factory.listener.onOpen(
            socket,
            Response.Builder().request(socket.request()).protocol(Protocol.HTTP_1_1)
                .code(101).message("Switching Protocols").build(),
        )

        val subscription = JSONArray(socket.sent.single())
        assertEquals("REQ", subscription.getString(0))
        assertEquals(30397, subscription.getJSONObject(2).getJSONArray("kinds").getInt(0))
        assertEquals(500, subscription.getJSONObject(2).getInt("limit"))

        factory.listener.onMessage(socket, "not JSON")
        factory.listener.onMessage(socket, """["EOSE","map"]""")
        assertTrue(notes.isEmpty())
        factory.listener.onMessage(
            socket,
            """["EVENT","map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A fictional gathering","tags":[["l","8FVC9G8F+5W","open-location-code"]]}]""",
        )
        assertEquals(1, notes.size)
        assertEquals("A fictional gathering", notes.single().content)
        assertEquals("a".repeat(64), notes.single().id)

        client.close()
        assertEquals(listOf(1000 to null), socket.closes)
    }

    @Test fun reportsRelayFailureAndClosesTheSameConnection() {
        var failures = 0
        val factory = RecordingSocketFactory()
        val client = NostrootsNotesClient({ error("Unexpected note") }, { failures++ }, factory)
        factory.listener.onFailure(factory.socket, IOException("Local relay disconnected"), null)
        assertEquals(1, failures)
        client.close()
        assertEquals(listOf(1000 to null), factory.socket.closes)
    }

    private class RecordingSocketFactory : WebSocket.Factory {
        lateinit var listener: WebSocketListener
        lateinit var socket: RecordingSocket
        override fun newWebSocket(request: Request, listener: WebSocketListener): WebSocket {
            this.listener = listener
            socket = RecordingSocket(request)
            return socket
        }
    }

    private class RecordingSocket(private val originalRequest: Request) : WebSocket {
        val sent = mutableListOf<String>()
        val closes = mutableListOf<Pair<Int, String?>>()
        override fun request() = originalRequest
        override fun queueSize() = 0L
        override fun send(text: String): Boolean { sent += text; return true }
        override fun send(bytes: ByteString) = false
        override fun close(code: Int, reason: String?): Boolean { closes += code to reason; return true }
        override fun cancel() = Unit
    }
}
