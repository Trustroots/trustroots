package org.trustroots.android.nostr

import java.math.BigInteger
import java.security.MessageDigest
import org.bouncycastle.crypto.params.ECPrivateKeyParameters
import org.bouncycastle.crypto.signers.BIP340Signer
import org.json.JSONArray
import org.json.JSONObject

internal object NostrEventSigner {
    fun publicKey(secret: ByteArray): String = NostrKeyCodec.publicKey(secret).toHex()

    fun sign(event: JSONObject, secret: ByteArray): JSONObject {
        val body = eventBody(event)
        val pubkey = publicKey(secret)
        val id = body.hash(pubkey)
        val signer = BIP340Signer().apply {
            init(true, ECPrivateKeyParameters(BigInteger(1, secret), BIP340Signer.getDomain()))
            update(id, 0, id.size)
        }
        return JSONObject().put("pubkey", pubkey).put("created_at", body.createdAt).put("kind", body.kind)
            .put("tags", JSONArray(body.tags.map { JSONArray(it) })).put("content", body.content)
            .put("id", id.toHex()).put("sig", signer.generateSignature().toHex())
    }

    fun describe(event: JSONObject): String {
        val body = eventBody(event)
        return JSONObject().put("kind", body.kind).put("created_at", body.createdAt)
            .put("tags", JSONArray(body.tags.map { JSONArray(it) })).put("content", body.content)
            .toString(2).replace(Regex("[\\p{Cf}\\u2028\\u2029]")) { match ->
                match.value.map { "\\u" + it.code.toString(16).padStart(4, '0') }.joinToString("")
            }
    }

    fun verifies(event: JSONObject, expectedAuthor: String): Boolean = runCatching {
        if (event.opt("pubkey") != expectedAuthor) return false
        val pubkey = BIP340Signer.decodePublicKey(decodeHex(expectedAuthor, 32)) ?: return false
        val id = eventBody(event).hash(expectedAuthor)
        if (event.opt("id") != id.toHex()) return false
        val signature = decodeHex(event.getString("sig"), 64)
        BIP340Signer().run {
            init(false, pubkey)
            update(id, 0, id.size)
            verifySignature(signature)
        }
    }.getOrDefault(false)

    private fun eventBody(event: JSONObject): EventBody {
        val kind = event.get("kind") as? Int ?: error("Invalid event kind")
        val createdAt = when (val timestamp = event.get("created_at")) {
            is Int -> timestamp.toLong()
            is Long -> timestamp
            else -> error("Invalid event timestamp")
        }
        val content = event.get("content") as? String ?: error("Invalid event content")
        require(kind in 0..65535 && createdAt in 0..9007199254740991L)
        val rawTags = event.getJSONArray("tags")
        val tags = List(rawTags.length()) { index ->
            val tag = rawTags.getJSONArray(index)
            List(tag.length()) { item -> tag.get(item) as? String ?: error("Invalid event tag") }
        }
        return EventBody(kind, createdAt, content, tags)
    }

    private data class EventBody(
        val kind: Int,
        val createdAt: Long,
        val content: String,
        val tags: List<List<String>>,
    ) {
        fun hash(pubkey: String): ByteArray {
            val encodedTags = tags.joinToString(",", "[", "]") { tag ->
                tag.joinToString(",", "[", "]", transform = ::quote)
            }
            val payload = "[0,${quote(pubkey)},$createdAt,$kind,$encodedTags,${quote(content)}]"
            return MessageDigest.getInstance("SHA-256").digest(payload.encodeToByteArray())
        }
    }

    fun decodeHex(value: String, size: Int): ByteArray {
        require(value.length == size * 2 && value.all { it in '0'..'9' || it in 'a'..'f' })
        return ByteArray(size) { value.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }

    // Match JSON.stringify's string encoding for the NIP-01 event ID, including
    // literal slashes, line separators and well-formed handling of lone surrogates.
    private fun quote(value: String): String = buildString {
        append('"')
        value.forEachIndexed { index, character ->
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\b' -> append("\\b")
                '\t' -> append("\\t")
                '\n' -> append("\\n")
                '\u000c' -> append("\\f")
                '\r' -> append("\\r")
                else -> {
                    val loneSurrogate =
                        (character.isHighSurrogate() && value.getOrNull(index + 1)?.isLowSurrogate() != true) ||
                            (character.isLowSurrogate() && value.getOrNull(index - 1)?.isHighSurrogate() != true)
                    if (character.code < 32 || loneSurrogate) {
                        append("\\u")
                        append(character.code.toString(16).padStart(4, '0'))
                    } else {
                        append(character)
                    }
                }
            }
        }
        append('"')
    }

    private fun ByteArray.toHex(): String = joinToString("") { (it.toInt() and 255).toString(16).padStart(2, '0') }
}
