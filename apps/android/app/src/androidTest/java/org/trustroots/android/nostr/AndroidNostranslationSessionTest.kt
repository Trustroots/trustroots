package org.trustroots.android.nostr

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
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
        val relay = RecordingNostranslationRelay()
        try {
            keys.generate()
            val localPublicKey = requireNotNull(keys.browserPublicKey(keys.revision()))
            fun requestFrame(
                subscription: String,
                transport: String,
                secret: ByteArray,
                id: String,
                method: String,
                params: JSONArray,
            ): JSONArray {
                val rpc = JSONObject().put("id", id).put("method", method).put("params", params)
                val event = NostrEventSigner.sign(JSONObject().put("kind", 24133)
                    .put("created_at", timestamp).put("tags", JSONArray().put(JSONArray().put("p").put(transport)))
                    .put("content", NostrConnectEncryption.encrypt(rpc.toString(), secret)), clientKey)
                return JSONArray().put("EVENT").put(subscription).put(event)
            }
            val link = requireNotNull(NostranslationConnectionLink.parse(
                "nostrconnect://$peer?relay=wss%3A%2F%2Frelay.trustroots.org" +
                    "&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture",
            ))
            val first = AndroidNostranslationSession(account, keys, scope, { true }, relay) { timestamp }
            val transport = first.use { signer ->
                signer.start()
                signer.pair(link)
                assertThrows(IllegalArgumentException::class.java) { signer.pair(link) }
                relay.open()
                val handshake = relay.frames[1].getJSONObject(1)
                val transport = handshake.getString("pubkey")
                assertTrue(NostrEventSigner.verifies(handshake, transport))
                val subscription = relay.frames[0].getString(1)
                val secret = NostrConnectEncryption.conversationKey(clientKey, NostrEventSigner.decodeHex(transport, 32))
                repeat(9) {
                    relay.receive(requestFrame(subscription, transport, secret, "early-$it", "get_public_key", JSONArray()))
                }
                assertEquals(2, relay.frames.size)
                relay.receive(JSONArray().put("OK").put(handshake.getString("id")).put(true))
                assertEquals(listOf(peer), signer.connectedClients)
                val earlyReplies = relay.frames.drop(2).map { frame ->
                    val event = frame.getJSONObject(1)
                    val reply = JSONObject(NostrConnectEncryption.decrypt(event.getString("content"), secret))
                    assertEquals(localPublicKey, reply.getString("result"))
                    reply.getString("id")
                }
                assertEquals((0 until 8).map { "early-$it" }, earlyReplies)
                transport
            }

            val secret = NostrConnectEncryption.conversationKey(clientKey, NostrEventSigner.decodeHex(transport, 32))
            var signedIn = true
            var signOutDuringRequest = false
            AndroidNostranslationSession(account, keys, scope, { signedIn }, relay) {
                if (signOutDuringRequest) signedIn = false
                timestamp
            }.use { restored ->
                restored.start()
                relay.open()
                assertEquals(listOf(peer), restored.connectedClients)
                assertThrows(IllegalArgumentException::class.java) { restored.pair(link) }
                assertEquals(1, relay.frames.size)
                val subscription = relay.frames.single().getString(1)
                val tags = JSONArray().put(JSONArray().put("u").put("https://nostranslation-api.trustroots.org/api/reviews"))
                    .put(JSONArray().put("method").put("POST"))
                    .put(JSONArray().put("payload").put("a".repeat(64)))
                val review = JSONObject().put("kind", 27235).put("content", "")
                    .put("tags", tags).put("created_at", timestamp)
                fun requestFrame(id: String, method: String, params: JSONArray): JSONArray {
                    return requestFrame(subscription, transport, secret, id, method, params)
                }
                fun reviewFrame(id: String): JSONArray {
                    review.put("created_at", timestamp)
                    return requestFrame(id, "sign_event", JSONArray().put(review.toString()))
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

                relay.receive(JSONArray().put("EVENT").put("another-subscription").put(input.getJSONObject(2)))
                relay.receive(JSONArray().put("EVENT").put(subscription))
                relay.receive(JSONArray().put("EVENT").put(subscription).put(JSONObject()))
                relay.receive("not a relay frame")
                relay.receive("x".repeat(32_769))
                relay.receive(JSONArray().put("OK").put("unrelated-acknowledgement").put(true))
                assertEquals(4, relay.frames.size)

                for ((method, params, response) in listOf(
                    Triple("connect", JSONArray().put(transport), "ack"),
                    Triple("get_public_key", JSONArray(), localPublicKey),
                    Triple("unknown", JSONArray(), "Unsupported method."),
                )) {
                    val before = relay.frames.size
                    relay.receive(requestFrame(method, method, params))
                    assertEquals(before + 1, relay.frames.size)
                    val event = relay.frames.last().getJSONObject(1)
                    assertTrue(NostrEventSigner.verifies(event, transport))
                    val rpc = JSONObject(NostrConnectEncryption.decrypt(event.getString("content"), secret))
                    assertEquals(method, rpc.getString("id"))
                    assertEquals(response, rpc.getString(if (method == "unknown") "error" else "result"))
                }
                val malformedReviews = listOf(
                    JSONObject(review.toString()).put("created_at", "invalid"),
                    JSONObject(review.toString()).put("tags", JSONArray().put(1)),
                )
                malformedReviews.forEachIndexed { index, invalidReview ->
                    val id = "invalid-review-$index"
                    relay.receive(requestFrame(id, "sign_event", JSONArray().put(invalidReview.toString())))
                    val invalidReply = relay.frames.last().getJSONObject(1)
                    val invalidResult = JSONObject(NostrConnectEncryption.decrypt(invalidReply.getString("content"), secret))
                    assertEquals(id, invalidResult.getString("id"))
                    assertEquals("Authorisation unavailable. Retry in Nostranslation.", invalidResult.getString("error"))
                    assertTrue(restored.reviews.isEmpty())
                }

                relay.receive(reviewFrame("superseded-review"))
                val superseded = restored.reviews.single()
                timestamp = superseded.approval.expiresAt + 1
                relay.receive(reviewFrame("replacement-review"))
                val replacement = restored.reviews.single()
                assertEquals("replacement-review", replacement.id)
                restored.decide(superseded, approved = true)
                assertEquals(listOf(replacement), restored.reviews)
                restored.decide(replacement, approved = false)
                val afterRequests = relay.frames.size

                relay.receive(reviewFrame("sign-out-before-approval"))
                val signedOutReview = restored.reviews.single()
                signOutDuringRequest = true
                relay.receive(reviewFrame("received-during-sign-out"))
                signOutDuringRequest = false
                assertFalse(signedIn)
                assertEquals(listOf(signedOutReview), restored.reviews)
                relay.receive(reviewFrame("received-after-sign-out"))
                assertEquals(listOf(signedOutReview), restored.reviews)
                restored.decide(signedOutReview, approved = true)
                assertTrue(restored.reviews.isEmpty())
                assertEquals(afterRequests, relay.frames.size)
                assertThrows(IllegalStateException::class.java) { restored.revoke(peer) }
                assertEquals(listOf(peer), restored.connectedClients)
                signedIn = true

                relay.receive(reviewFrame("disconnect-before-approval"))
                val disconnectedReview = restored.reviews.single()
                relay.closed()
                relay.closed()
                relay.open()
                restored.decide(disconnectedReview, approved = true)
                assertTrue(restored.relayFailed)
                assertTrue(relay.cancelled)
                assertTrue(restored.reviews.isEmpty())
                assertEquals(afterRequests, relay.frames.size)
                assertEquals(listOf(peer), restored.connectedClients)

                restored.revoke(peer)
                assertTrue(restored.connectedClients.isEmpty())
                assertEquals(0, keys.loadPairings(keys.revision()).length())
                assertTrue(relay.cancelled)
                relay.receive(input)
                assertEquals(afterRequests, relay.frames.size)

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

    @Test fun pendingPairingsReserveClientSlotsUntilTheRelayDisconnects() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val account = nostrAccountScope("https://example.test", "pairing-limit-${UUID.randomUUID()}")
        val keys = AndroidNostrKeys(context, account)
        val relay = RecordingNostranslationRelay()
        val job = Job()
        val scope = CoroutineScope(Dispatchers.Unconfined + job)
        try {
            keys.generate()
            val links = (1..9).map { index ->
                val peer = NostrEventSigner.publicKey(ByteArray(32).apply { this[31] = index.toByte() })
                requireNotNull(NostranslationConnectionLink.parse(
                    "nostrconnect://$peer?relay=wss%3A%2F%2Frelay.trustroots.org" +
                        "&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture",
                ))
            }
            var signedIn = true
            var signOutBeforeRelaySend = false
            AndroidNostranslationSession(account, keys, scope, { signedIn }, relay) {
                if (signOutBeforeRelaySend) signedIn = false
                1_800_000_000L
            }.use { signer ->
                signer.start()
                links.take(8).forEach(signer::pair)
                assertThrows(IllegalArgumentException::class.java) { signer.pair(links.last()) }
                assertEquals(8, relay.connectionsCreated)
                assertTrue(signer.connectedClients.isEmpty())

                assertFalse(signer.relayFailed)
                relay.acceptsFrames = false
                relay.open()
                assertTrue(signer.relayFailed)
                assertTrue(relay.frames.isEmpty())
                assertTrue(signer.connectedClients.isEmpty())

                relay.fail()
                signer.pair(links.last())
                assertEquals(9, relay.connectionsCreated)
                assertTrue(signer.connectedClients.isEmpty())

                relay.acceptsFrames = true
                signOutBeforeRelaySend = true
                relay.open()
                assertFalse(signedIn)
                assertTrue(relay.frames.isEmpty())
            }
        } finally {
            job.cancel()
            keys.remove()
        }
    }

    @Test fun rejectsNewReviewsAtCapacityAndRevokesEveryQueuedApproval() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val account = nostrAccountScope("https://example.test", "queue-${UUID.randomUUID()}")
        val keys = AndroidNostrKeys(context, account)
        val clientKey = ByteArray(32).apply { this[31] = 1 }
        val transportKey = ByteArray(32).apply { this[31] = 2 }
        val peer = NostrEventSigner.publicKey(clientKey)
        val transport = NostrEventSigner.publicKey(transportKey)
        val secret = NostrConnectEncryption.conversationKey(clientKey, NostrEventSigner.decodeHex(transport, 32))
        val now = Int.MAX_VALUE.toLong() + 3_600
        val job = Job()
        val relay = RecordingNostranslationRelay()
        try {
            keys.generate()
            val revision = keys.revision()
            keys.savePairings(revision, JSONArray().put(JSONObject()
                .put("peer", peer).put("transport", "0".repeat(63) + "2")
                .put("signer", requireNotNull(keys.browserPublicKey(revision)))))
            val scope = CoroutineScope(Dispatchers.Unconfined + job)
            AndroidNostranslationSession(account, keys, scope, { true }, relay) { now }.use { signer ->
                signer.start()
                relay.open()
                val subscription = relay.frames.single().getString(1)
                val authorisation = JSONObject().put("kind", 27235).put("created_at", now).put("content", "")
                    .put("tags", JSONArray(listOf(
                        listOf("u", "https://nostranslation-api.trustroots.org/api/reviews"),
                        listOf("method", "POST"),
                        listOf("payload", "a".repeat(64)),
                    )))
                for (index in 1..9) {
                    val request = JSONObject().put("id", "queued-$index").put("method", "sign_event")
                        .put("params", JSONArray().put(authorisation.toString()))
                    val envelope = JSONObject().put("kind", 24133).put("created_at", now)
                        .put("tags", JSONArray(listOf(listOf("p", transport))))
                        .put("content", NostrConnectEncryption.encrypt(request.toString(), secret))
                    relay.receive(JSONArray().put("EVENT").put(subscription).put(NostrEventSigner.sign(envelope, clientKey)))
                }

                assertEquals((1..8).map { "queued-$it" }, signer.reviews.map { it.id })
                assertEquals(2, relay.frames.size)
                val reply = relay.frames.last().getJSONObject(1)
                val result = JSONObject(NostrConnectEncryption.decrypt(reply.getString("content"), secret))
                assertEquals("queued-9", result.getString("id"))
                assertEquals("Authorisation unavailable. Retry in Nostranslation.", result.getString("error"))

                val queued = signer.reviews
                signer.revoke(peer)
                assertTrue(signer.reviews.isEmpty())
                assertTrue(signer.connectedClients.isEmpty())
                assertTrue(relay.cancelled)
                queued.forEach { signer.decide(it, approved = true) }
                assertEquals(2, relay.frames.size)
            }
        } finally {
            job.cancel()
            keys.remove()
        }
    }
}

internal class RecordingNostranslationRelay : WebSocket.Factory {
    val frames = mutableListOf<JSONArray>()
    var acceptsFrames = true
    var connectionsCreated = 0
        private set
    var cancelled = false
        private set
    private lateinit var socket: WebSocket
    private lateinit var listener: WebSocketListener

    override fun newWebSocket(request: Request, listener: WebSocketListener): WebSocket {
        connectionsCreated += 1
        frames.clear()
        cancelled = false
        this.listener = listener
        socket = object : WebSocket {
            override fun request() = request
            override fun queueSize() = 0L
            override fun send(text: String): Boolean = acceptsFrames && frames.add(JSONArray(text))
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

    fun receive(frame: JSONArray) = receive(frame.toString())

    fun receive(frame: String) = listener.onMessage(socket, frame)

    fun closed() = listener.onClosed(socket, 1000, "Fixture relay closed.")

    fun fail() = listener.onFailure(socket, IOException("Fixture relay disconnected."), null)
}
