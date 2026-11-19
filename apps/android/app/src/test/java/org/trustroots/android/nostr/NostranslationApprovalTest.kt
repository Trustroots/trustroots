package org.trustroots.android.nostr

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.shared.nostr.NostrAccountScope
import org.trustroots.shared.nostr.NostrSigningSession
import org.trustroots.shared.nostr.NostranslationPairing

class NostranslationApprovalTest {
    private val now = 1800000000L
    private val client = "1".repeat(64)
    private val identity = "2".repeat(64)
    private val otherKey = "3".repeat(64)
    private val account = NostrAccountScope("https://example.test", "alice")
    private val session = NostrSigningSession().apply { activate(account) }
    private val pairing = NostranslationPairing(account, client, identity)
    private val destination = "https://nostranslation-api.trustroots.org/api/reviews"
    private val payload = "a".repeat(64)
    private val tags = listOf(listOf("u", destination), listOf("method", "POST"), listOf("payload", payload))

    @Test fun reviewExposesItsDestinationAndApprovalPreservesTheExactEventOnce() {
        val review = requireNotNull(prepare())
        assertEquals(destination, review.destination)
        assertEquals(now + 60, review.expiresAt)
        val event = requireNotNull(review.approve(now + 60, identity))
        assertEquals(27235, event.kind)
        assertEquals(now, event.createdAt)
        assertEquals("", event.content)
        assertEquals(payload, event.payloadDigest)
        assertEquals(identity, event.signingPublicKey)
        assertEquals(tags, event.tags)
        assertNull(review.approve(now + 60, identity))
    }

    @Test fun keepsTheEventHashProducedByTheNostranslationClient() {
        // Values from authorisation() and getEventHash() for a synthetic review body.
        val secret = ByteArray(32).apply { this[31] = 1 }
        val pubkey = NostrEventSigner.publicKey(secret)
        val requestTags = listOf(
            listOf("u", destination),
            listOf("method", "POST"),
            listOf("payload", "b450769b004fdf226c0b7feb39eb965785e935972d018f65dc5359df2987bac8"),
        )
        val approval = requireNotNull(NostranslationPairing(account, client, pubkey).prepareReview(
            session, client, pubkey, 27235, now, "", requestTags, now,
        ))
        val approved = requireNotNull(approval.approve(now, pubkey))
        val event = JSONObject().put("kind", approved.kind).put("created_at", approved.createdAt)
            .put("content", approved.content)
            .put("tags", JSONArray().apply { approved.tags.forEach { put(JSONArray(it)) } })
        val signed = NostrEventSigner.sign(event, secret)
        assertEquals("a028598edf92db9731ada251fb9995e7a6ba5a51e1b183cd4b1b64990e02e631", signed.getString("id"))
        assertEquals(approved.signingPublicKey, signed.getString("pubkey"))
    }

    @Test fun rejectsAChangedEndpointIncludingQueryOrLookalikeHost() {
        for (url in listOf(
            "http://nostranslation-api.trustroots.org/api/reviews",
            "https://nostranslation-api.trustroots.org.example.test/api/reviews",
            "https://nostranslation-api.trustroots.org/api/catalogue",
            "$destination/",
            "$destination?test=1",
            "$destination#preview",
        )) {
            assertNull(prepare(tags = listOf(listOf("u", url)) + tags.drop(1)))
        }
    }

    @Test fun rejectsOtherMethodsMissingDuplicateExtraAndInvalidTags() {
        for (invalid in listOf(
            tags.dropLast(1),
            tags + listOf(listOf("p", client)),
            tags.take(2) + listOf(tags[0]),
            tags.take(2) + listOf(listOf("payload", "unhashed")),
            tags.take(2) + listOf(listOf("payload", payload, "extra")),
            listOf(tags[0], listOf("method", "GET"), tags[2]),
        )) {
            assertNull(prepare(tags = invalid))
        }
        assertNull(prepare(kind = 1))
        assertNull(prepare(content = "unexpected content"))
    }

    @Test fun matchesTheServerClockWindowBothAtReviewAndAtApproval() {
        assertNotNull(prepare(createdAt = now - 60))
        assertNotNull(prepare(createdAt = now + 60))
        assertNull(prepare(createdAt = now - 61))
        assertNull(prepare(createdAt = now + 61))
        assertNull(prepare(createdAt = Long.MIN_VALUE))
        val review = requireNotNull(prepare())
        assertNull(review.approve(now + 61, identity))
        assertNull(review.approve(now, identity)) // An expired decision cannot be retried against a changed clock.
    }

    @Test fun requiresAnActiveAccountAndKeyAndAnAuthenticatedMatchingPeer() {
        assertThrows(IllegalArgumentException::class.java) { NostranslationPairing(account, "invalid", identity) }
        assertThrows(IllegalArgumentException::class.java) { NostranslationPairing(account, client, "invalid") }
        assertNull(prepare(peer = otherKey))
        assertNull(prepare(localPublicKey = otherKey))
        session.activate(NostrAccountScope("https://other.example.test", "alice"))
        assertNull(prepare())
        session.activate(NostrAccountScope("https://example.test", "bob"))
        assertNull(prepare())
        session.pause()
        assertNull(prepare())
    }

    @Test fun signOutAndKeyRevisionChangesCancelOnlyThePendingApproval() {
        val beforePause = requireNotNull(prepare())
        session.pause()
        session.activate(account)
        assertNull(beforePause.approve(now, identity))
        val beforeKeyChange = requireNotNull(prepare())
        session.invalidate()
        assertNull(beforeKeyChange.approve(now, identity))
        assertNull(prepare(localPublicKey = otherKey))
        assertFalse(pairing.isRevoked)
        assertNotNull(requireNotNull(prepare()).approve(now, identity))
    }

    @Test fun denialRevocationAndChangingTheKeyAtApprovalAllRejectTheRequest() {
        val denied = requireNotNull(prepare())
        denied.deny()
        assertNull(denied.approve(now, identity))
        assertNull(requireNotNull(prepare()).approve(now, otherKey))

        val revoked = requireNotNull(prepare())
        pairing.revoke()
        assertTrue(pairing.isRevoked)
        assertNull(revoked.approve(now, identity))
        assertNull(prepare())
    }

    @Test fun aMutableTransportPayloadCannotChangeWhatIsApproved() {
        val mutable = tags.map { it.toMutableList() }.toMutableList()
        val approval = requireNotNull(prepare(tags = mutable))
        mutable.first()[1] = "https://example.test/api/reviews"
        mutable.clear()
        val event = requireNotNull(approval.approve(now, identity))
        assertEquals(tags, event.tags)
        (event.tags[0] as MutableList<String>)[1] = "https://example.test/api/reviews"
        assertEquals(tags, event.tags)
    }

    private fun prepare(
        peer: String = client,
        localPublicKey: String = identity,
        kind: Int = 27235,
        createdAt: Long = now,
        content: String = "",
        tags: List<List<String>> = this.tags,
    ) = pairing.prepareReview(session, peer, localPublicKey, kind, createdAt, content, tags, now)
}
