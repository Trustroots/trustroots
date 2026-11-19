package org.trustroots.android.nostr

import java.math.BigInteger
import java.net.URI
import java.security.MessageDigest
import org.bouncycastle.crypto.params.ECPrivateKeyParameters
import org.bouncycastle.crypto.signers.BIP340Signer
import org.json.JSONArray
import org.json.JSONObject

internal object NostrProfileProof {
    fun sign(event: JSONObject, backend: String, secret: ByteArray, now: Long = System.currentTimeMillis() / 1000): JSONObject {
        val kind = event.get("kind")
        val timestamp = event.get("created_at")
        require(kind == 27235 && (timestamp is Int || timestamp is Long) && event.get("content") == "")
        val createdAt = (timestamp as Number).toLong()
        require(createdAt in (now - 300)..(now + 30))

        val tags = event.getJSONArray("tags")
        require(tags.length() == 3)
        val entries = (0 until tags.length()).associate { index ->
            val tag = tags.getJSONArray(index)
            require(tag.length() == 2)
            (tag.get(0) as? String ?: error("Expected a tag name")) to
                (tag.get(1) as? String ?: error("Expected a tag value"))
        }
        require(entries["method"] == "PUT" && entries["challenge"]?.matches(Regex("[a-f0-9]{64}")) == true)
        val destination = URI(requireNotNull(entries["u"]))
        val server = URI(backend)
        require(destination.scheme.equals(server.scheme, ignoreCase = true))
        require(destination.host != null && destination.host.equals(server.host, ignoreCase = true))
        require(port(destination) == port(server) && destination.rawPath == "/api/users")
        require(destination.rawQuery == null && destination.rawFragment == null && destination.rawUserInfo == null)

        val pubkey = NostrKeyCodec.publicKey(secret).hex()
        // Android's JSON writer can escape URL slashes. NIP-01 hashes unescaped slashes.
        val payload = JSONArray().put(0).put(pubkey).put(createdAt).put(27235).put(tags).put("")
            .toString().replace("\\/", "/")
        val id = MessageDigest.getInstance("SHA-256").digest(payload.encodeToByteArray())
        val signer = BIP340Signer().apply {
            init(true, ECPrivateKeyParameters(BigInteger(1, secret), BIP340Signer.getDomain()))
            update(id, 0, id.size)
        }
        return JSONObject().put("pubkey", pubkey).put("created_at", createdAt).put("kind", 27235)
            .put("tags", tags).put("content", "").put("id", id.hex()).put("sig", signer.generateSignature().hex())
    }

    private fun port(uri: URI): Int = if (uri.port != -1) uri.port else if (uri.scheme.equals("https", true)) 443 else 80

    private fun ByteArray.hex(): String = joinToString("") { (it.toInt() and 255).toString(16).padStart(2, '0') }
}
