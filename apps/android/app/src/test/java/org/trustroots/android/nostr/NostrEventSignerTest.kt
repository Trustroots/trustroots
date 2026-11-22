package org.trustroots.android.nostr

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class NostrEventSignerTest {
    private val secret = ByteArray(32).apply { this[31] = 1 }

    @Test fun matchesNip01HashForUnicodeEscapesAndLiteralSlashes() {
        val event = JSONObject().put("kind", 1).put("created_at", 1800000000).put(
            "content", "été 🌍\u2028https://example.test/\n\"\\\u0001",
        ).put("tags", JSONArray().put(JSONArray().put("t").put("radiostr"))
            .put(JSONArray().put("r").put("https://example.test/")))
        val proof = NostrEventSigner.sign(event, secret)
        assertEquals("622115a10994ce038823b0b7e0681ef15f0af016481642ed29725471402eb83a", proof.getString("id"))
        assertEquals(event.getString("content"), proof.getString("content"))
        assertEquals(event.getJSONArray("tags").toString(), proof.getJSONArray("tags").toString())
    }

    @Test fun refusesNonStringTagValuesAndNonIntegralTimestamps() {
        val event = JSONObject().put("kind", 1).put("created_at", 1800000000).put("content", "")
        event.put("tags", JSONArray().put(JSONArray().put("t").put(42)))
        assertThrows(IllegalStateException::class.java) { NostrEventSigner.sign(event, secret) }
        event.put("tags", JSONArray()).put("created_at", 1.25)
        assertThrows(IllegalStateException::class.java) { NostrEventSigner.sign(event, secret) }
    }

    @Test fun matchesNip01HashForLongTimestampAndUnpairedSurrogates() {
        val event = event().put("kind", 65535).put("created_at", 9007199254740991L)
            .put("content", "\b\t\u000c\r\ud800a\udc00")
        val signed = NostrEventSigner.sign(event, secret)
        assertEquals("0ed550d7bf974792ae44954ed9807c0cf77fe3b21ee6c6729b3967f6a8615575", signed.getString("id"))
    }

    @Test fun rejectsInvalidEventTypesAndNumbersOutsideNip01Bounds() {
        for (candidate in listOf(event().put("kind", "1"), event().put("content", 42))) {
            assertThrows(IllegalStateException::class.java) { NostrEventSigner.sign(candidate, secret) }
        }
        for (candidate in listOf(
            event().put("kind", -1), event().put("kind", 65536),
            event().put("created_at", -1), event().put("created_at", 9007199254740992L),
        )) {
            assertThrows(IllegalArgumentException::class.java) { NostrEventSigner.sign(candidate, secret) }
        }
    }

    private fun event() = JSONObject().put("kind", 1).put("created_at", 1800000000)
        .put("content", "").put("tags", JSONArray())
}
