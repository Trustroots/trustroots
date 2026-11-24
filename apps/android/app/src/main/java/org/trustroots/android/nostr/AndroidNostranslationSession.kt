package org.trustroots.android.nostr

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import org.trustroots.shared.nostr.NostrAccountScope
import org.trustroots.shared.nostr.NostrSigningSession
import org.trustroots.shared.nostr.NostranslationApproval
import org.trustroots.shared.nostr.NostranslationPairing

/** One foreground account. WebSocket callbacks are serialised on the caller's main-thread scope. */
internal class AndroidNostranslationSession(
    private val account: NostrAccountScope,
    private val keys: AndroidNostrKeys,
    private val scope: CoroutineScope,
    private val isSignedIn: () -> Boolean,
    private val sockets: WebSocket.Factory,
    private val now: () -> Long,
) : AutoCloseable {
    private data class Client(val peer: String, val transportSecret: String, val signingKey: String) {
        fun encode() = JSONObject().put("peer", peer).put("transport", transportSecret).put("signer", signingKey)
    }

    private data class Connection(
        val wire: AndroidNostrConnectWire,
        val policy: NostranslationPairing,
        val subscription: String = UUID.randomUUID().toString(),
        var socket: WebSocket? = null,
        var handshakeId: String? = null,
        val earlyEvents: MutableList<JSONArray> = mutableListOf(),
    )

    internal data class Review(val client: String, val id: String, val approval: NostranslationApproval)

    private val signing = NostrSigningSession().apply { activate(account) }
    private val revision = keys.revision()
    private val connections = mutableMapOf<String, Connection>()
    private val receivedRequests = NostranslationRequestHistory()
    private var clients = emptyList<Client>()
    var reviews by mutableStateOf(emptyList<Review>())
        private set
    var connectedClients by mutableStateOf(emptyList<String>())
        private set
    var relayFailed by mutableStateOf(false)
        private set

    fun start() {
        val localKey = currentPublicKey() ?: return
        val records = keys.loadPairings(revision)
        clients = List(records.length()) { index ->
            val entry = records.getJSONObject(index)
            Client(entry.getString("peer"), entry.getString("transport"), entry.getString("signer"))
        }.filter { it.signingKey == localKey }
        connectedClients = clients.map(Client::peer)
        clients.forEach { connect(it) }
    }

    suspend fun recoverPending(load: suspend (String) -> JSONArray) {
        for (client in clients) {
            val connection = connections[client.peer] ?: continue
            val events = try {
                load(connection.wire.transportPublicKey)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // The live relay can still deliver the review.
                continue
            }
            if (!isCurrent(client, connection)) continue
            for (index in 0 until minOf(events.length(), 8)) {
                val event = events.optJSONObject(index) ?: continue
                receive(client, connection, JSONArray().put("EVENT").put(connection.subscription).put(event))
            }
        }
    }

    fun pair(link: NostranslationConnectionLink) {
        val localKey = checkNotNull(currentPublicKey())
        val knownPeers = clients.map(Client::peer).toSet() + connections.keys
        require(knownPeers.size < 8 && link.clientPublicKey !in knownPeers)
        val secret = NostrKeyCodec.generate()
        try {
            val encoded = secret.joinToString("") { "%02x".format(it.toInt() and 255) }
            connect(Client(link.clientPublicKey, encoded, localKey), link.secret)
        } finally {
            secret.fill(0)
        }
    }

    fun revoke(peer: String) {
        checkNotNull(currentPublicKey())
        save(clients.filterNot { it.peer == peer })
        reviews.filter { it.client == peer }.forEach { it.approval.deny() }
        reviews = reviews.filterNot { it.client == peer }
        disconnect(peer)
    }

    fun decide(review: Review, approved: Boolean) {
        if (review !in reviews) return
        reviews = reviews - review
        val key = currentPublicKey() ?: return
        val connection = connections[review.client] ?: return
        val timestamp = now()
        if (!approved) {
            review.approval.deny()
            publish(connection, connection.wire.error(review.id, "Authorisation denied.", timestamp))
            return
        }
        val event = review.approval.approve(timestamp, key)
        val signed = event?.let {
            val tags = JSONArray(it.tags.map(::JSONArray))
            val unsigned = JSONObject().put("kind", it.kind).put("content", it.content)
                .put("created_at", it.createdAt).put("tags", tags)
            keys.signBrowserEvent(unsigned, revision)
        }
        val response = if (signed == null) {
            connection.wire.error(review.id, "Authorisation expired. Retry in Nostranslation.", timestamp)
        } else {
            connection.wire.response(review.id, signed.toString(), timestamp)
        }
        publish(connection, response)
    }

    private fun connect(client: Client, pairingSecret: String? = null) {
        val bytes = NostrKeyCodec.import(client.transportSecret)
        val wire = try {
            AndroidNostrConnectWire(client.peer, bytes, pairingSecret)
        } finally {
            bytes.fill(0)
        }
        val connection = Connection(wire, NostranslationPairing(account, client.peer, client.signingKey))
        connections[client.peer] = connection
        val request = Request.Builder().url(NostranslationConnectionLink.relayURL).build()
        connection.socket = sockets.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) = withCurrentConnection {
                val filter = JSONObject().put("kinds", JSONArray(listOf(24133)))
                    .put("authors", JSONArray(listOf(client.peer)))
                    .put("#p", JSONArray(listOf(wire.transportPublicKey))).put("since", now() - 60)
                val handshake = pairingSecret?.let { wire.handshake(now()) }
                connection.handshakeId = handshake?.getString("id")
                send(connection, JSONArray().put("REQ").put(connection.subscription).put(filter))
                if (handshake != null) publish(connection, handshake)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (text.length > 32_768) return
                withCurrentConnection {
                    val frame = runCatching { JSONArray(text) }.getOrNull() ?: return@withCurrentConnection
                    receive(client, connection, frame)
                }
            }

            private fun withCurrentConnection(action: () -> Unit) {
                scope.launch {
                    runCatching {
                        if (isCurrent(client, connection)) action()
                    }.onFailure { relayFailed = true }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = failed()

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = failed()

            private fun failed() {
                scope.launch {
                    if (connections[client.peer] === connection) {
                        disconnect(client.peer)
                        relayFailed = true
                    }
                }
            }
        })
    }

    private fun receive(client: Client, connection: Connection, frame: JSONArray) {
        when (frame.optString(0)) {
            "OK" -> {
                val pending = connection.handshakeId ?: return
                if (frame.opt(1) != pending) return
                if (frame.opt(2) != true) {
                    disconnect(client.peer)
                    relayFailed = true
                    return
                }
                save(clients + client)
                connection.handshakeId = null
                val waiting = connection.earlyEvents.toList()
                connection.earlyEvents.clear()
                waiting.forEach { receive(client, connection, it) }
            }
            "EVENT" -> {
                if (frame.opt(1) != connection.subscription) return
                if (client !in clients) {
                    if (connection.earlyEvents.size < 8) connection.earlyEvents.add(frame)
                    return
                }
                val event = frame.optJSONObject(2) ?: return
                val timestamp = now()
                val request = connection.wire.decodeRequest(event, timestamp) ?: return
                if (receivedRequests.record(client.peer, request.id, timestamp)) {
                    handleRequest(client, connection, request, timestamp)
                }
            }
        }
    }

    private fun handleRequest(client: Client, connection: Connection, request: NostrConnectRequest, timestamp: Long) {
        val key = currentPublicKey() ?: return
        val wire = connection.wire
        val response = when (val command = request.command) {
            NostrConnectCommand.Connect -> wire.response(request.id, "ack", timestamp)
            NostrConnectCommand.PublicKey -> wire.response(request.id, key, timestamp)
            NostrConnectCommand.Unsupported -> wire.error(request.id, "Unsupported method.", timestamp)
            is NostrConnectCommand.SignEvent -> {
                reviews = reviews.filter { it.approval.expiresAt >= timestamp }
                val approval = prepareReview(client, connection, command.event, key, timestamp)
                if (approval != null && reviews.size < 8) {
                    reviews = reviews + Review(client.peer, request.id, approval)
                    return
                }
                wire.error(request.id, "Authorisation unavailable. Retry in Nostranslation.", timestamp)
            }
        }
        publish(connection, response)
    }

    private fun prepareReview(client: Client, connection: Connection, event: JSONObject, key: String, timestamp: Long): NostranslationApproval? =
        runCatching {
            val kind = event.get("kind") as Int
            val createdAt = when (val value = event.get("created_at")) {
                is Int -> value.toLong()
                is Long -> value
                else -> return null
            }
            val tags = event.getJSONArray("tags")
            val ordered = List(tags.length()) { index ->
                val tag = tags.getJSONArray(index)
                List(tag.length()) { item -> tag.get(item) as String }
            }
            connection.policy.prepareReview(signing, client.peer, key, kind, createdAt, event.get("content") as String, ordered, timestamp)
        }.getOrNull()

    private fun currentPublicKey(): String? =
        if (signing.scope != null && isSignedIn()) keys.browserPublicKey(revision) else null

    private fun isCurrent(client: Client, connection: Connection): Boolean =
        connections[client.peer] === connection && currentPublicKey() == client.signingKey

    private fun save(next: List<Client>) {
        keys.savePairings(revision, JSONArray(next.map(Client::encode)))
        clients = next
        connectedClients = next.map(Client::peer)
    }

    private fun publish(connection: Connection, event: JSONObject) =
        send(connection, JSONArray().put("EVENT").put(event))

    private fun send(connection: Connection, frame: JSONArray) {
        if (currentPublicKey() != null && connection.socket?.send(frame.toString()) != true) relayFailed = true
    }

    private fun disconnect(peer: String) {
        val connection = connections.remove(peer) ?: return
        connection.policy.revoke()
        connection.socket?.cancel()
        connection.wire.close()
    }

    override fun close() {
        signing.pause()
        reviews.forEach { it.approval.deny() }
        reviews = emptyList()
        connections.keys.toList().forEach(::disconnect)
    }
}

internal class NostranslationRequestHistory {
    private val received = LinkedHashMap<Pair<String, String>, Long>()

    fun record(peer: String, requestId: String, timestamp: Long): Boolean {
        received.entries.removeAll { it.value < timestamp - 120 }
        val request = peer to requestId
        if (request in received || received.size >= 256) return false
        received[request] = timestamp
        return true
    }
}
