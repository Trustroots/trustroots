package org.trustroots.android.api

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject

data class CommunityNote(
    val id: String,
    val content: String,
    val createdAt: Long,
    val latitude: Double,
    val longitude: Double,
    val author: String,
)

class NostrootsNotesClient(
    private val onNote: (CommunityNote) -> Unit,
    private val onError: () -> Unit,
) {
    private val socket: WebSocket = httpClient.newWebSocket(
        Request.Builder().url("wss://relay.trustroots.org").build(),
        object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send("""["REQ","trustroots-android-map",{"kinds":[30397],"limit":500}]""")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                parseCommunityNote(text)?.let(onNote)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                onError()
            }
        },
    )

    fun close() {
        socket.close(1000, null)
    }

    private companion object {
        val httpClient = OkHttpClient()
    }
}

internal fun parseCommunityNote(message: String): CommunityNote? = runCatching {
    val envelope = JSONArray(message)
    if (envelope.optString(0) != "EVENT") return@runCatching null
    val event = envelope.optJSONObject(2) ?: return@runCatching null
    if (event.optInt("kind") != 30397) return@runCatching null
    val id = event.optString("id")
    val author = event.optString("pubkey").lowercase()
    val signature = event.optString("sig")
    if (!id.matches(Regex("[0-9a-fA-F]{64}")) ||
        !author.matches(Regex("[0-9a-f]{64}")) ||
        !signature.matches(Regex("[0-9a-fA-F]{128}"))) return@runCatching null
    val content = event.optString("content").takeIf { it.length <= 10_000 } ?: return@runCatching null
    val tags = event.optJSONArray("tags") ?: return@runCatching null
    val code = (0 until tags.length()).mapNotNull { tags.optJSONArray(it) }
        .firstOrNull { it.optString(0) == "l" && it.optString(2) == "open-location-code" }
        ?.optString(1) ?: return@runCatching null
    val coordinates = decodeOpenLocationCode(code) ?: return@runCatching null
    CommunityNote(id, content, event.optLong("created_at") * 1000, coordinates.first, coordinates.second, author)
}.getOrNull()

internal fun decodeOpenLocationCode(code: String): Pair<Double, Double>? {
    val alphabet = "23456789CFGHJMPQRVWX"
    val clean = code.uppercase().filter { it != '+' && it != '0' }
    if (clean.length < 8 || clean.length > 15) return null
    val pairResolutions = doubleArrayOf(20.0, 1.0, 0.05, 0.0025, 0.000125)
    var latitude = -90.0
    var longitude = -180.0
    var latitudeResolution = 20.0
    var longitudeResolution = 20.0
    var index = 0
    while (index + 1 < minOf(clean.length, 10)) {
        val pairIndex = index / 2
        val latitudeDigit = alphabet.indexOf(clean[index]).takeIf { it >= 0 } ?: return null
        val longitudeDigit = alphabet.indexOf(clean[index + 1]).takeIf { it >= 0 } ?: return null
        val resolution = pairResolutions[pairIndex]
        latitude += latitudeDigit * resolution
        longitude += longitudeDigit * resolution
        latitudeResolution = resolution
        longitudeResolution = resolution
        index += 2
    }
    if (clean.length > 10) {
        for (character in clean.drop(10)) {
            val digit = alphabet.indexOf(character).takeIf { it >= 0 } ?: return null
            latitudeResolution /= 5
            longitudeResolution /= 4
            latitude += (digit / 4) * latitudeResolution
            longitude += (digit % 4) * longitudeResolution
        }
    }
    val centre = latitude + latitudeResolution / 2 to longitude + longitudeResolution / 2
    return centre.takeIf { it.first in -90.0..90.0 && it.second in -180.0..180.0 }
}
