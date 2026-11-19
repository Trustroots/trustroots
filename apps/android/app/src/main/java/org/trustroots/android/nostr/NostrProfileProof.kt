package org.trustroots.android.nostr

import java.net.URI
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

        return NostrEventSigner.sign(event, secret)
    }

    private fun port(uri: URI): Int = if (uri.port != -1) uri.port else if (uri.scheme.equals("https", true)) 443 else 80
}
