package org.trustroots.android.api

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NostrootsNotesDefaultClientTest {
    @Test
    fun defaultHttpClientConnectsToAnOfflineLocalRelayAndSendsTheNotesSubscription() {
        MockWebServer().use { server ->
            val subscription = AtomicReference<String?>()
            val receivedSubscription = CountDownLatch(1)
            server.enqueue(
                MockResponse.Builder()
                    .webSocketUpgrade(object : WebSocketListener() {
                        override fun onMessage(webSocket: WebSocket, text: String) {
                            subscription.set(text)
                            receivedSubscription.countDown()
                            webSocket.close(1000, "fixture complete")
                        }
                    })
                    .build(),
            )
            server.start()
            val relayUrl = server.url("/fictional-relay").toString().replaceFirst("http:", "ws:")
            val failures = AtomicReference<Throwable?>()
            val client = NostrootsNotesClient(
                onNote = { error("The local relay sent no note events") },
                onError = { failures.compareAndSet(null, IllegalStateException("Default relay connection failed")) },
                relayUrl = relayUrl,
            )

            try {
                assertTrue(
                    "The default OkHttp client should deliver the subscription to the loopback relay",
                    receivedSubscription.await(5, TimeUnit.SECONDS),
                )
                val message = JSONArray(requireNotNull(subscription.get()))
                assertEquals("REQ", message.getString(0))
                assertEquals("trustroots-android-map", message.getString(1))
                assertEquals(30397, message.getJSONObject(2).getJSONArray("kinds").getInt(0))
                assertEquals(500, message.getJSONObject(2).getInt("limit"))
                assertNull("The local default client must not report a relay error", failures.get())
                assertEquals("/fictional-relay", server.takeRequest(5, TimeUnit.SECONDS)?.target)
            } finally {
                client.close()
            }
        }
    }
}
