package org.trustroots.android.notifications

import org.bouncycastle.crypto.signers.BIP340Signer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class NostranslationAlertProofTest {
    private val backend = "https://api.example.test"
    private val now = 1800000000L
    private val secret = ByteArray(32).apply { this[31] = 1 }
    private val peer = "fixture-peer"
    private val transport = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"

    @Test fun signsOnlyTheBoundRegistrationChallengeWithTheTransportKey() {
        val event = challenge()
        val proof = sign(event)
        assertEquals(transport, proof.getString("pubkey"))
        assertEquals(event.getJSONArray("tags").toString(), proof.getJSONArray("tags").toString())
        val hash = decodeHex(proof.getString("id"))
        val verifier = BIP340Signer().apply {
            init(false, BIP340Signer.decodePublicKey(decodeHex(transport)))
            update(hash, 0, hash.size)
        }
        assertTrue(verifier.verifySignature(decodeHex(proof.getString("sig"))))
    }

    @Test fun rejectsAChangedDestinationOrAChallengeForAnotherRegistration() {
        for ((name, replacement) in listOf(
            "endpoint" to "https://push.example.test/elsewhere",
            "publicKey" to "different-key",
            "auth" to "different-auth",
        )) {
            assertThrows(IllegalArgumentException::class.java) {
                sign(challenge(), destination().put(name, replacement))
            }
        }
        for (event in listOf(
            challenge().put("kind", 1),
            challenge().put("content", "unexpected"),
            challenge().put("created_at", now - 121),
            challenge().put("created_at", now + 31),
            challenge().put("tags", JSONArray()),
            challenge().also { it.getJSONArray("tags").put(0, JSONArray().put("u")) },
            challenge().also { it.getJSONArray("tags").getJSONArray(0).put(1, "$backend/another-route") },
            challenge().also { it.getJSONArray("tags").getJSONArray(1).put(1, "POST") },
            challenge().also { it.getJSONArray("tags").getJSONArray(2).put(1, "0".repeat(64)) },
            challenge().also { it.getJSONArray("tags").getJSONArray(3).put(0, "duplicate") },
            challenge().also { it.getJSONArray("tags").getJSONArray(3).put(1, "malformed") },
        )) {
            assertThrows(IllegalArgumentException::class.java) { sign(event) }
        }
    }

    private fun sign(event: JSONObject, destination: JSONObject = destination()) =
        signNostranslationAlertChallenge(event, "$backend/", peer, transport, destination, secret, now)

    private fun destination() = JSONObject().put("endpoint", "https://push.example.test/review")
        .put("publicKey", "fixture-key").put("auth", "fixture-auth")

    private fun challenge() = JSONObject().put("kind", 27235).put("created_at", now).put("content", "")
        .put("tags", JSONArray()
            .put(JSONArray().put("u").put("$backend/api/mobile/v0/nostranslation/alerts"))
            .put(JSONArray().put("method").put("PUT"))
            .put(JSONArray().put("payload").put("9c9c572dfd2636c5677996e96e1ab74e743d0a471c80a0187dc4e888987b60cf"))
            .put(JSONArray().put("challenge").put("a".repeat(64))))

    private fun decodeHex(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
