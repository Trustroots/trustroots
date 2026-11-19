package org.trustroots.android.nostr

import java.net.URI
import java.net.URLDecoder
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** Connection link metadata is supplied by the client. The member must still approve the pairing. */
internal class NostranslationConnectionLink private constructor(
    val clientPublicKey: String,
    internal val secret: String,
) {
    val relay: String get() = relayURL
    val clientURL: String get() = nostranslationURL

    companion object {
        const val relayURL = "wss://relay.trustroots.org"
        private const val nostranslationURL = "https://team.trustroots.org/nostranslation"

        fun parse(raw: String): NostranslationConnectionLink? = runCatching {
            val text = raw.trim()
            require(text.length in 1..2048)
            val uri = URI(text)
            require(uri.scheme.equals("nostrconnect", ignoreCase = true))
            require(uri.rawFragment == null && uri.rawPath.isNullOrEmpty())
            val peer = requireNotNull(uri.rawAuthority)
            NostrEventSigner.decodeHex(peer, 32)
            val params = mutableMapOf<String, String>()
            for (pair in requireNotNull(uri.rawQuery).split('&')) {
                val name = URLDecoder.decode(pair.substringBefore('='), "UTF-8")
                require('=' in pair)
                val value = URLDecoder.decode(pair.substringAfter('='), "UTF-8")
                require(params.put(name, value) == null)
            }
            require(params.keys.all { it in setOf("relay", "url", "perms", "secret", "name") })
            require(params["relay"] == relayURL && params["url"] == nostranslationURL && params["perms"] == "sign_event:27235")
            val secret = requireNotNull(params["secret"]).also { require(it.matches(Regex("[a-zA-Z0-9_-]{1,128}"))) }
            NostranslationConnectionLink(peer, secret)
        }.getOrNull()
    }
}

internal sealed interface NostrConnectCommand {
    data object Connect : NostrConnectCommand
    data object PublicKey : NostrConnectCommand
    class SignEvent(val event: JSONObject) : NostrConnectCommand
    data object Unsupported : NostrConnectCommand
}

internal class NostrConnectRequest(val id: String, val eventId: String, val command: NostrConnectCommand)

/** Encodes one confirmed pairing. Its caller owns relay I/O, deduplication and session checks. */
internal class AndroidNostrConnectWire(
    link: NostranslationConnectionLink,
    transportSecret: ByteArray,
) : AutoCloseable {
    private val secret = transportSecret.copyOf()
    private val peer = link.clientPublicKey
    private var pairingSecret: String? = link.secret
    val transportPublicKey = NostrEventSigner.publicKey(secret)
    private val conversationKey = NostrConnectEncryption.conversationKey(secret, NostrEventSigner.decodeHex(peer, 32))
    private var closed = false

    fun handshake(now: Long): JSONObject {
        val result = checkNotNull(pairingSecret)
        val id = UUID.randomUUID().toString()
        return wrap(JSONObject().put("id", id).put("result", result), id, now).also {
            pairingSecret = null
        }
    }

    fun decodeRequest(event: JSONObject, now: Long): NostrConnectRequest? = runCatching {
        if (closed || pairingSecret != null || event.opt("kind") != eventKind) return null
        val value = event.opt("created_at")
        if (value !is Int && value !is Long) return null
        val timestamp = (value as Number).toLong()
        if (now !in 1..9007199254740991L || timestamp !in (now - 300)..(now + 30)) return null
        val tags = event.getJSONArray("tags")
        val recipient = tags.getJSONArray(0)
        if (tags.length() != 1 || recipient.length() != 2 ||
            recipient.opt(0) != "p" || recipient.opt(1) != transportPublicKey
        ) return null
        val content = event.opt("content") as? String ?: return null
        if (content.length !in 132..NostrConnectEncryption.maxEncoded ||
            !NostrEventSigner.verifies(event, peer)
        ) return null

        val rpc = JSONObject(NostrConnectEncryption.decrypt(content, conversationKey))
        val id = rpc.opt("id") as? String ?: return null
        if (!validId(id)) return null
        val params = rpc.getJSONArray("params")
        val method = rpc.opt("method") as? String ?: return null
        val command = when {
            method == "get_public_key" && params.length() == 0 -> NostrConnectCommand.PublicKey
            method == "sign_event" && params.length() == 1 && params.opt(0) is String ->
                NostrConnectCommand.SignEvent(JSONObject(params.getString(0)))
            method == "connect" && params.length() in 1..4 && params.opt(0) == transportPublicKey ->
                NostrConnectCommand.Connect
            else -> NostrConnectCommand.Unsupported
        }
        NostrConnectRequest(id, event.getString("id"), command)
    }.getOrNull()

    fun response(id: String, result: String, now: Long): JSONObject {
        check(pairingSecret == null)
        return wrap(JSONObject().put("id", id).put("result", result), id, now)
    }

    fun error(id: String, message: String, now: Long): JSONObject {
        check(pairingSecret == null)
        return wrap(JSONObject().put("id", id).put("error", message), id, now)
    }

    private fun wrap(rpc: JSONObject, id: String, now: Long): JSONObject {
        check(!closed)
        require(validId(id))
        val event = JSONObject().put("kind", eventKind).put("created_at", now)
            .put("tags", JSONArray().put(JSONArray().put("p").put(peer)))
            .put("content", NostrConnectEncryption.encrypt(rpc.toString(), conversationKey))
        return NostrEventSigner.sign(event, secret)
    }

    override fun close() {
        closed = true
        pairingSecret = null
        conversationKey.fill(0)
        secret.fill(0)
    }

    private companion object {
        const val eventKind = 24133
        val idPattern = Regex("[a-zA-Z0-9_.:-]{1,128}")
        fun validId(id: String): Boolean = idPattern.matches(id)
    }
}
