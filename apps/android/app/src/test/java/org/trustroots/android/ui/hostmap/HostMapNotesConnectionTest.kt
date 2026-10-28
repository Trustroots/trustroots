package org.trustroots.android.ui.hostmap

import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.CommunityNote

class HostMapNotesConnectionTest {
    @Test
    fun injectedSocketFactoryUsesTheDefaultRelayUrlAndClosesTheSocket() {
        val factory = RecordingSocketFactory()
        val connection = createNostrootsNotesConnection(
            onNote = {},
            onError = {},
            socketFactory = factory,
        )

        assertEquals("relay.trustroots.org", factory.socket.request().url.host)
        assertTrue(factory.socket.request().url.isHttps)
        connection.close()
        assertEquals(listOf(1000 to null), factory.socket.closes)
    }

    @Test
    fun connectionAdapterDeliversRelayNotesAndClosesTheSocket() {
        val subscriptions = LinkedBlockingQueue<String>()
        val closeCodes = LinkedBlockingQueue<Int>()
        val serverClosed = CountDownLatch(1)
        val receivedNote = LinkedBlockingQueue<CommunityNote>()
        val errors = AtomicInteger()

        MockWebServer().use { server ->
            server.enqueue(
                MockResponse.Builder().webSocketUpgrade(object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        webSocket.send(
                            """["EVENT","trustroots-android-map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A fictional note","tags":[["l","8FVC9G8+5W","open-location-code"]]}]""",
                        )
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        subscriptions.add(text)
                    }

                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                        closeCodes.add(code)
                        webSocket.close(code, reason)
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        serverClosed.countDown()
                    }
                }).build(),
            )
            server.start()
            val localRelayUrl = server.url("/host-map-relay").toString().replaceFirst("http:", "ws:")
            val connection = createNostrootsNotesConnection(
                onNote = receivedNote::add,
                onError = { errors.incrementAndGet() },
                relayUrl = localRelayUrl,
            )

            try {
                val subscription = subscriptions.poll(3, TimeUnit.SECONDS)
                assertNotNull("The adapter should establish its relay subscription", subscription)
                assertTrue(subscription!!.contains("\"REQ\""))

                val note = receivedNote.poll(3, TimeUnit.SECONDS)
                assertNotNull("The adapter should forward a decoded note", note)
                assertEquals("A fictional note", note!!.content)
                assertEquals("a".repeat(64), note.id)

                connection.close()
                assertEquals(1000, closeCodes.poll(3, TimeUnit.SECONDS))
                assertTrue("Closing the adapter should close its relay socket", serverClosed.await(3, TimeUnit.SECONDS))
                assertEquals(0, errors.get())
            } finally {
                connection.close()
            }
        }
    }

    private class RecordingSocketFactory : WebSocket.Factory {
        lateinit var socket: RecordingWebSocket

        override fun newWebSocket(request: Request, listener: WebSocketListener): WebSocket =
            RecordingWebSocket(request).also { socket = it }
    }

    private class RecordingWebSocket(private val originalRequest: Request) : WebSocket {
        val closes = mutableListOf<Pair<Int, String?>>()

        override fun request() = originalRequest
        override fun queueSize() = 0L
        override fun send(text: String) = true
        override fun send(bytes: ByteString) = true
        override fun close(code: Int, reason: String?): Boolean {
            closes += code to reason
            return true
        }
        override fun cancel() = Unit
    }
}
