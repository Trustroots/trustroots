package org.trustroots.android.nostr

import java.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.shared.nostr.NostrAccountScope
import org.trustroots.shared.nostr.NostrSigningSession
import org.trustroots.shared.nostr.NostranslationPairing

class AndroidNostrConnectWireTest {
    private val fixture = JSONObject(requireNotNull(javaClass.getResourceAsStream("/nostranslation-wire.json"))
        .bufferedReader().use { it.readText() })
    private val now = fixture.getLong("now")
    private val linkText = fixture.getString("link")
    private val link = requireNotNull(NostranslationConnectionLink.parse(linkText))
    private val transportKey = key(2)
    private val clientKey = key(1)
    private val conversation = NostrConnectEncryption.conversationKey(clientKey, NostrKeyCodec.publicKey(transportKey))

    @Test fun acceptsTheBrowserLinkAndRejectsOtherRelaysSchemesAndPermissions() {
        assertEquals("wss://relay.trustroots.org", link.relay)
        assertEquals("https://team.trustroots.org/nostranslation", link.clientURL)
        assertEquals(NostrEventSigner.publicKey(clientKey), link.clientPublicKey)
        for (invalid in listOf(
            "",
            "$linkText&name=${"x".repeat(2048)}",
            "nostrconnect:invalid",
            linkText.substringBefore('?'),
            "$linkText&name",
            "$linkText&unknown=value",
            linkText.replace("&secret=example-4412", ""),
            linkText.replace("nostrconnect:", "bunker:"),
            linkText.replace("relay.trustroots.org", "other.example.test"),
            linkText.replace("sign_event%3A27235", "sign_event%3A1"),
            linkText.replace("team.trustroots.org", "malicious.example.test"),
            linkText.replace("secret=example-4412", "secret="),
            linkText.replace("secret=example-4412", "secret=example%2B4412"),
            "$linkText&secret=another",
            "$linkText&relay=wss%3A%2F%2Frelay.trustroots.org",
            "$linkText#section",
            linkText.replace("?", "/?"),
        )) {
            assertNull(NostranslationConnectionLink.parse(invalid))
        }
    }

    @Test fun matchesBrowserNip44VectorsForUtf8AndPadding() {
        val expectedKey = NostrEventSigner.decodeHex(fixture.getString("conversationKey"), 32)
        assertArrayEquals(expectedKey, conversation)
        assertArrayEquals(expectedKey, NostrConnectEncryption.conversationKey(transportKey, NostrKeyCodec.publicKey(clientKey)))
        for ((name, text, nonce) in listOf(
            Triple("shortCiphertext", "été 🌍", 6),
            Triple("longCiphertext", "é".repeat(130), 7),
        )) {
            val ciphertext = fixture.getString(name)
            assertEquals(text, NostrConnectEncryption.decrypt(ciphertext, conversation))
            assertEquals(ciphertext, NostrConnectEncryption.encrypt(text, conversation, ByteArray(32) { nonce.toByte() }))
        }
    }

    @Test fun authenticatesCiphertextAndRejectsMalformedAndUnboundedPayloads() {
        val original = fixture.getString("shortCiphertext")
        val altered = Base64.getDecoder().decode(original).apply { this[34] = (this[34].toInt() xor 1).toByte() }
        val wrongVersion = Base64.getDecoder().decode(original).apply { this[0] = 3 }
        val rejected = listOf(
            "", "#unsupported", original.replace('A', '_'),
            Base64.getEncoder().encodeToString(altered), Base64.getEncoder().encodeToString(wrongVersion),
            original + "A".repeat(NostrConnectEncryption.maxEncoded),
        )
        for (payload in rejected) {
            assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.decrypt(payload, conversation) }
        }
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.decrypt(original, ByteArray(32)) }
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.encrypt("é".repeat(8193), conversation) }
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.encrypt("", conversation) }
    }

    @Test fun rejectsInvalidEncryptionInputsAndAuthenticatedPadding() {
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.conversationKey(clientKey, ByteArray(31)) }
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.encrypt("a".repeat(16_385), conversation) }
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.encrypt("value", ByteArray(31)) }
        assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.encrypt("value", conversation, ByteArray(31)) }
        for (size in listOf(98, 16_452)) {
            val encoded = Base64.getEncoder().encodeToString(ByteArray(size))
            assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.decrypt(encoded, conversation) }
        }
        for (padded in listOf(
            ByteArray(1),
            ByteArray(34),
            ByteArray(34).apply {
                this[0] = 64
                this[1] = 1
            },
            ByteArray(35).apply { this[1] = 1 },
        )) {
            assertThrows(IllegalArgumentException::class.java) { NostrConnectEncryption.decodeAuthenticatedPlaintext(padded) }
        }
    }

    @Test fun handshakeUsesTheTransportAuthorAndReturnsThePairingSecretOnce() {
        AndroidNostrConnectWire(link, transportKey).use { wire ->
            assertNull(wire.decodeRequest(fixture.getJSONObject("getPublicKey"), now))
            val message = wire.handshake(now)
            assertEquals(fixture.getString("recipient"), wire.transportPublicKey)
            assertTrue(NostrEventSigner.verifies(message, wire.transportPublicKey))
            assertEquals(link.clientPublicKey, message.getJSONArray("tags").getJSONArray(0).getString(1))
            assertEquals(24133, message.getInt("kind"))
            val reply = decryptReply(message)
            assertEquals("example-4412", reply.getString("result"))
            assertTrue(reply.getString("id").isNotBlank())
            assertThrows(IllegalStateException::class.java) { wire.handshake(now) }
        }
    }

    @Test fun decodesBrowserRequestsAndPassesTheOriginalEventToTheApprovalPolicy() {
        AndroidNostrConnectWire(link, transportKey).use { wire ->
            wire.handshake(now)
            val readKey = requireNotNull(wire.decodeRequest(fixture.getJSONObject("getPublicKey"), now))
            assertEquals("fixture-1", readKey.id)
            assertEquals(NostrConnectCommand.PublicKey, readKey.command)
            val memberPublicKey = NostrEventSigner.publicKey(key(3))
            val reply = wire.response(readKey.id, memberPublicKey, now)
            assertTrue(NostrEventSigner.verifies(reply, wire.transportPublicKey))
            assertEquals(memberPublicKey, decryptReply(reply).getString("result"))
            assertEquals(readKey.id, decryptReply(reply).getString("id"))

            val request = requireNotNull(wire.decodeRequest(fixture.getJSONObject("signReview"), now))
            val event = (request.command as NostrConnectCommand.SignEvent).event
            val rawTags = event.getJSONArray("tags")
            val tags = List(rawTags.length()) { index ->
                val tag = rawTags.getJSONArray(index)
                List(tag.length()) { tag.getString(it) }
            }
            val account = NostrAccountScope("https://example.test", "reviewer")
            val session = NostrSigningSession().apply { activate(account) }
            val pairing = NostranslationPairing(account, link.clientPublicKey, memberPublicKey)
            val approval = requireNotNull(pairing.prepareReview(
                session, link.clientPublicKey, memberPublicKey, event.getInt("kind"), event.getLong("created_at"),
                event.getString("content"), tags, now,
            ))
            assertEquals("https://nostranslation-api.trustroots.org/api/reviews", approval.destination)
            assertEquals(tags, approval.approve(now, memberPublicKey)?.tags)

            val unsupported = requireNotNull(wire.decodeRequest(fixture.getJSONObject("unsupported"), now))
            assertEquals(NostrConnectCommand.Unsupported, unsupported.command)
            assertEquals("Unsupported method.", decryptReply(wire.error(unsupported.id, "Unsupported method.", now)).getString("error"))
            assertEquals(NostrConnectCommand.Connect, wire.decodeRequest(fixture.getJSONObject("connect"), now)?.command)
        }
    }

    @Test fun rejectsWrongAuthorsRecipientsHashesSignaturesAndStaleEvents() {
        AndroidNostrConnectWire(link, transportKey).use { wire ->
            wire.handshake(now)
            val original = fixture.getJSONObject("getPublicKey")
            assertNull(wire.decodeRequest(original, now + 301))
            val insecure = JSONObject(original.toString()).put("id", "0".repeat(64))
            assertNull(wire.decodeRequest(insecure, now))
            assertFalse(NostrEventSigner.verifies(insecure, link.clientPublicKey))
            assertNull(wire.decodeRequest(JSONObject(original.toString()).put("sig", "0".repeat(128)), now))
            val wrongPeer = NostrEventSigner.sign(original, key(3))
            assertTrue(NostrEventSigner.verifies(wrongPeer, NostrEventSigner.publicKey(key(3))))
            assertNull(wire.decodeRequest(wrongPeer, now))
            val otherTags = JSONArray().put(JSONArray().put("p").put(NostrEventSigner.publicKey(key(3))))
            val wrongRecipient = NostrEventSigner.sign(JSONObject(original.toString()).put("tags", otherTags), clientKey)
            assertTrue(NostrEventSigner.verifies(wrongRecipient, link.clientPublicKey))
            assertNull(wire.decodeRequest(wrongRecipient, now))
            wire.close()
            assertNull(wire.decodeRequest(original, now))
            assertThrows(IllegalStateException::class.java) { wire.response("fixture-1", "ack", now) }
        }
    }

    @Test fun checksEnvelopeShapesAndBothTimeBounds() {
        AndroidNostrConnectWire(link, transportKey).use { wire ->
            assertThrows(IllegalStateException::class.java) { wire.response("fixture-1", "ack", now) }
            assertThrows(IllegalStateException::class.java) { wire.error("fixture-1", "denied", now) }
            wire.handshake(now)
            val original = fixture.getJSONObject("getPublicKey")
            assertEquals(NostrConnectCommand.PublicKey, wire.decodeRequest(JSONObject(original.toString()).put("created_at", now), now)?.command)
            for (time in listOf(0L, 9_007_199_254_740_992L, now - 31)) {
                assertNull(wire.decodeRequest(original, time))
            }
            val extraTags = JSONArray(original.getJSONArray("tags").toString()).put(JSONArray().put("x"))
            for ((field, value) in listOf(
                "kind" to 1,
                "created_at" to "not-a-timestamp",
                "tags" to extraTags,
                "tags" to JSONArray().put(JSONArray().put("p")),
                "tags" to JSONArray().put(JSONArray().put("e").put(wire.transportPublicKey)),
                "content" to false,
                "content" to "short",
                "content" to "a".repeat(NostrConnectEncryption.maxEncoded + 1),
            )) {
                assertNull(wire.decodeRequest(JSONObject(original.toString()).put(field, value), now))
            }
            assertThrows(IllegalArgumentException::class.java) { wire.response("invalid id", "ack", now) }
        }
    }

    @Test fun rejectsMalformedRequestFieldsAndUnsupportedMethodArguments() {
        AndroidNostrConnectWire(link, transportKey).use { wire ->
            wire.handshake(now)
            for ((name, value) in listOf(
                "id" to 7,
                "id" to "invalid id",
                "method" to false,
                "params" to "not-an-array",
            )) {
                val request = rpc("get_public_key", JSONArray()).put(name, value)
                assertNull(wire.decodeRequest(envelope(request), now))
            }
            val invalidArguments = listOf(
                rpc("get_public_key", JSONArray().put(true)),
                rpc("sign_event", JSONArray()),
                rpc("sign_event", JSONArray().put(true)),
                rpc("connect", JSONArray()),
                rpc("connect", JSONArray().put("wrong-transport")),
                rpc("connect", JSONArray().put(wire.transportPublicKey).put(1).put(2).put(3).put(4)),
            )
            for (request in invalidArguments) {
                assertEquals(NostrConnectCommand.Unsupported, wire.decodeRequest(envelope(request), now)?.command)
            }
        }
    }

    @Test fun rejectsOutOfRangeEventFieldsAndInvalidSigningValues() {
        val original = fixture.getJSONObject("getPublicKey")
        for ((name, value) in listOf(
            "kind" to "24133",
            "kind" to -1,
            "kind" to 65_536,
            "created_at" to -1L,
            "created_at" to 9_007_199_254_740_992L,
            "content" to true,
        )) {
            val invalid = JSONObject(original.toString()).put(name, value)
            assertThrows(RuntimeException::class.java) { NostrEventSigner.sign(invalid, clientKey) }
        }
        val invalidAuthor = "f".repeat(64)
        assertFalse(NostrEventSigner.verifies(JSONObject().put("pubkey", invalidAuthor), invalidAuthor))
        val invalidSignature = JSONObject(original.toString()).put("sig", "not-a-signature")
        assertFalse(NostrEventSigner.verifies(invalidSignature, link.clientPublicKey))
        for (invalid in listOf("0", "0/", "0A", "0g")) {
            assertThrows(IllegalArgumentException::class.java) { NostrEventSigner.decodeHex(invalid, 1) }
        }
    }

    @Test fun hashesLoneSurrogatesAndControlCharactersLikeTheBrowser() {
        val event = JSONObject().put("kind", 1).put("created_at", now).put("tags", JSONArray())
            .put("content", "\uDC00a\uDC00\uD800b\b\t\u000c\r🌍\uD800")
        val signed = NostrEventSigner.sign(event, clientKey)
        assertEquals("e00adf6e8de2ac0c832971b99813b02ab89b73ef5b9035ceeab817ce9f20a9e7", signed.getString("id"))
        assertTrue(NostrEventSigner.verifies(signed, link.clientPublicKey))
    }

    private fun rpc(method: String, params: JSONArray) =
        JSONObject().put("id", "fixture-test").put("method", method).put("params", params)

    private fun envelope(rpc: JSONObject): JSONObject {
        val event = JSONObject(fixture.getJSONObject("getPublicKey").toString())
            .put("content", NostrConnectEncryption.encrypt(rpc.toString(), conversation))
        return NostrEventSigner.sign(event, clientKey)
    }

    private fun key(last: Int) = ByteArray(32).apply { this[31] = last.toByte() }

    private fun decryptReply(event: JSONObject): JSONObject =
        JSONObject(NostrConnectEncryption.decrypt(event.getString("content"), conversation))
}
