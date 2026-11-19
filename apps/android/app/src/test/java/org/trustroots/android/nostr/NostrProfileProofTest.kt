package org.trustroots.android.nostr

import org.bouncycastle.crypto.signers.BIP340Signer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class NostrProfileProofTest {
    private val origin = "https://api.example.test"
    private val now = 1800000000L
    private val secret = ByteArray(32).apply { this[31] = 1 }

    @Test fun signsTheNip01HashWithListenerCompatibleSchnorrSignature() {
        val proof = NostrProfileProof.sign(challenge(), origin, secret, now)
        val eventId = "9af102f958207f7c30598187abbd293d29ffd19a15faf04c9836f612f2f9eb7a"
        val publicKey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
        assertEquals(eventId, proof.getString("id"))
        assertEquals(publicKey, proof.getString("pubkey"))
        val hash = decodeHex(eventId)
        val verifier = BIP340Signer().apply {
            init(false, BIP340Signer.decodePublicKey(decodeHex(publicKey)))
            update(hash, 0, hash.size)
        }
        assertTrue(verifier.verifySignature(decodeHex(proof.getString("sig"))))
    }

    @Test fun rejectsAnUnrelatedDestinationOrAChangedChallenge() {
        for (event in listOf(
            challenge(destination = "https://other.example.test/api/users"),
            challenge(destination = "$origin:8443/api/users"),
            challenge(destination = "$origin/api/users?x=1"),
            challenge(destination = "$origin/api/mobile/v0/profile"),
            challenge(method = "POST"),
            challenge(nonce = "wrong"),
            challenge().put("created_at", now - 301),
            challenge().put("created_at", now + 31),
            challenge().put("kind", 1),
            challenge().put("content", "unrelated"),
        )) {
            assertThrows(IllegalArgumentException::class.java) { NostrProfileProof.sign(event, origin, secret, now) }
        }
    }

    private fun challenge(
        destination: String = "$origin/api/users",
        method: String = "PUT",
        nonce: String = "a".repeat(64),
    ) = JSONObject().put("kind", 27235).put("created_at", now).put("content", "").put("tags", JSONArray()
        .put(JSONArray().put("u").put(destination))
        .put(JSONArray().put("method").put(method))
        .put(JSONArray().put("challenge").put(nonce)))

    private fun decodeHex(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
