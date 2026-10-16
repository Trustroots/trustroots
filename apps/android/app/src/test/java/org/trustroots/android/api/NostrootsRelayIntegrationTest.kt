package org.trustroots.android.api

import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NostrootsRelayIntegrationTest {
    @Test fun defaultTransportSubscribesDeliversNotesAndClosesItsLocalRelayConnection() {
        val subscriptions = LinkedBlockingQueue<String>()
        val notes = LinkedBlockingQueue<CommunityNote>()
        val closeCodes = LinkedBlockingQueue<Int>()
        val closed = CountDownLatch(1)
        val failures = AtomicInteger()
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse.Builder().webSocketUpgrade(object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        webSocket.send("""["EOSE","trustroots-android-map"]""")
                        webSocket.send(
                            """["EVENT","trustroots-android-map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A fictional meetup","tags":[["l","8FVC9G8F+5W","open-location-code"]]}]""",
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
                        closed.countDown()
                    }
                }).build(),
            )
            server.start()
            val client = NostrootsNotesClient(
                onNote = { notes.add(it) },
                onError = { failures.incrementAndGet() },
                relayUrl = server.url("/relay").toString().replaceFirst("http://", "ws://"),
            )
            try {
                val subscription = subscriptions.poll(3, TimeUnit.SECONDS)
                assertNotNull("The real WebSocket transport should subscribe", subscription)
                val request = JSONArray(subscription!!)
                assertEquals("REQ", request.getString(0))
                assertEquals("trustroots-android-map", request.getString(1))
                assertEquals(30397, request.getJSONObject(2).getJSONArray("kinds").getInt(0))
                assertEquals(500, request.getJSONObject(2).getInt("limit"))

                val note = notes.poll(3, TimeUnit.SECONDS)
                assertNotNull("The local relay event should reach the application", note)
                assertEquals("a".repeat(64), note!!.id)
                assertEquals("b".repeat(64), note.author)
                assertEquals("A fictional meetup", note.content)
                assertEquals(1700000000000L, note.createdAt)
                val upgrade = server.takeRequest(3, TimeUnit.SECONDS)!!
                assertEquals("/relay", upgrade.url.encodedPath)
                assertEquals("websocket", upgrade.headers["Upgrade"])
                client.close()
                assertEquals(1000, closeCodes.poll(3, TimeUnit.SECONDS))
                assertTrue("The relay connection should close cleanly", closed.await(3, TimeUnit.SECONDS))
                assertEquals(0, failures.get())
                assertTrue("Control frames must not become notes", notes.isEmpty())
            } finally {
                client.close()
            }
        }
    }

    @Test fun defaultTransportReportsARejectedLocalRelayHandshake() {
        val failed = CountDownLatch(1)
        val notes = LinkedBlockingQueue<CommunityNote>()
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 503, body = "Relay temporarily unavailable"))
            server.start()
            val client = NostrootsNotesClient(
                onNote = { notes.add(it) },
                onError = { failed.countDown() },
                relayUrl = server.url("/relay").toString().replaceFirst("http://", "ws://"),
            )
            try {
                assertTrue("A rejected WebSocket handshake should report the failure", failed.await(3, TimeUnit.SECONDS))
                assertNotNull(server.takeRequest(3, TimeUnit.SECONDS))
                assertTrue(notes.isEmpty())
            } finally {
                client.close()
            }
        }
    }
}
