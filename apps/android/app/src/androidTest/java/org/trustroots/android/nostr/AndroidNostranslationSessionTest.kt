package org.trustroots.android.nostr

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidNostranslationSessionTest {
    @Test fun pairsRestoresApprovesExactlyOnceAndRevokesAClient() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val account = nostrAccountScope("https://example.test", "review-${UUID.randomUUID()}")
        val keys = AndroidNostrKeys(context, account)
        val clientKey = ByteArray(32).apply { this[31] = 1 }
        val peer = NostrEventSigner.publicKey(clientKey)
        var timestamp = 1_800_000_000L
        val job = Job()
        val scope = CoroutineScope(Dispatchers.Unconfined + job)
        val relay = RecordingRelay()
        try {
            keys.generate()
            val localPublicKey = requireNotNull(keys.browserPublicKey(keys.revision()))
            val link = requireNotNull(NostranslationConnectionLink.parse(
                "nostrconnect://$peer?relay=wss%3A%2F%2Frelay.trustroots.org" +
                    "&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture",
            ))
            val first = AndroidNostranslationSession(account, keys, scope, { true }, relay) { timestamp }
            val transport = first.use { signer ->
                signer.start()
                signer.pair(link)
                relay.open()
                val handshake = relay.frames[1].getJSONObject(1)
                val transport = handshake.getString("pubkey")
                assertTrue(NostrEventSigner.verifies(handshake, transport))
                relay.receive(JSONArray().put("OK").put(handshake.getString("id")).put(true))
                assertEquals(listOf(peer), signer.connectedClients)
                transport
            }

            val secret = NostrConnectEncryption.conversationKey(clientKey, NostrEventSigner.decodeHex(transport, 32))
            AndroidNostranslationSession(account, keys, scope, { true }, relay) { timestamp }.use { restored ->
                restored.start()
                relay.open()
                assertEquals(listOf(peer), restored.connectedClients)
                assertEquals(1, relay.frames.size)
                val subscription = relay.frames.single().getString(1)
                val tags = JSONArray().put(JSONArray().put("u").put("https://nostranslation-api.trustroots.org/api/reviews"))
                    .put(JSONArray().put("method").put("POST"))
                    .put(JSONArray().put("payload").put("a".repeat(64)))
                val review = JSONObject().put("kind", 27235).put("content", "")
                    .put("tags", tags).put("created_at", timestamp)
                fun reviewFrame(id: String): JSONArray {
                    review.put("created_at", timestamp)
                    val rpc = JSONObject().put("id", id).put("method", "sign_event")
                        .put("params", JSONArray().put(review.toString()))
                    val event = NostrEventSigner.sign(JSONObject().put("kind", 24133)
                        .put("created_at", timestamp).put("tags", JSONArray().put(JSONArray().put("p").put(transport)))
                        .put("content", NostrConnectEncryption.encrypt(rpc.toString(), secret)), clientKey)
                    return JSONArray().put("EVENT").put(subscription).put(event)
                }

                val input = reviewFrame("fixture-review")
                relay.receive(input)
                assertEquals(1, relay.frames.size)
                restored.decide(restored.reviews.single(), approved = true)
                val reply = relay.frames.last().getJSONObject(1)
                assertTrue(NostrEventSigner.verifies(reply, transport))
                val result = JSONObject(NostrConnectEncryption.decrypt(reply.getString("content"), secret))
                val signed = JSONObject(result.getString("result"))
                assertEquals("fixture-review", result.getString("id"))
                assertEquals(tags.toString(), signed.getJSONArray("tags").toString())
                assertTrue(NostrEventSigner.verifies(signed, localPublicKey))

                relay.receive(input)
                assertTrue(restored.reviews.isEmpty())
                assertEquals(2, relay.frames.size)

                relay.receive(reviewFrame("denied-review"))
                val denied = restored.reviews.single()
                restored.decide(denied, approved = false)
                restored.decide(denied, approved = true)
                assertTrue(restored.reviews.isEmpty())
                assertEquals(3, relay.frames.size)
                val denial = relay.frames.last().getJSONObject(1)
                val deniedResult = JSONObject(NostrConnectEncryption.decrypt(denial.getString("content"), secret))
                assertEquals("denied-review", deniedResult.getString("id"))
                assertEquals("Authorisation denied.", deniedResult.getString("error"))

                relay.receive(reviewFrame("expired-review"))
                val expired = restored.reviews.single()
                timestamp = expired.approval.expiresAt + 1
                restored.decide(expired, approved = true)
                assertTrue(restored.reviews.isEmpty())
                assertEquals(4, relay.frames.size)
                val expiry = relay.frames.last().getJSONObject(1)
                val expiredResult = JSONObject(NostrConnectEncryption.decrypt(expiry.getString("content"), secret))
                assertEquals("expired-review", expiredResult.getString("id"))
                assertEquals("Authorisation expired. Retry in Nostranslation.", expiredResult.getString("error"))

                restored.revoke(peer)
                assertTrue(restored.connectedClients.isEmpty())
                assertEquals(0, keys.loadPairings(keys.revision()).length())
                assertTrue(relay.cancelled)
                relay.receive(input)
                assertEquals(4, relay.frames.size)

                restored.pair(link)
                relay.open()
                val retry = relay.frames[1].getJSONObject(1)
                relay.receive(JSONArray().put("OK").put("different-request").put(true))
                assertTrue(restored.connectedClients.isEmpty())
                relay.receive(JSONArray().put("OK").put(retry.getString("id")).put(false))
                assertTrue(restored.relayFailed)
                assertTrue(relay.cancelled)
                assertEquals(0, keys.loadPairings(keys.revision()).length())
            }
        } finally {
            job.cancel()
            keys.remove()
        }
    }

    private class RecordingRelay : WebSocket.Factory {
        val frames = mutableListOf<JSONArray>()
        var cancelled = false
            private set
        private lateinit var socket: WebSocket
        private lateinit var listener: WebSocketListener

        override fun newWebSocket(request: Request, listener: WebSocketListener): WebSocket {
            frames.clear()
            cancelled = false
            this.listener = listener
            socket = object : WebSocket {
                override fun request() = request
                override fun queueSize() = 0L
                override fun send(text: String): Boolean = frames.add(JSONArray(text))
                override fun send(bytes: ByteString) = false
                override fun close(code: Int, reason: String?) = true
                override fun cancel() { cancelled = true }
            }
            return socket
        }

        fun open() {
            val response = Response.Builder().request(socket.request()).protocol(Protocol.HTTP_1_1)
                .code(101).message("Switching Protocols").build()
            listener.onOpen(socket, response)
        }

        fun receive(frame: JSONArray) = listener.onMessage(socket, frame.toString())
    }
}
