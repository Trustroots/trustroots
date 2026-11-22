package org.trustroots.android.nostr

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class NostrKeyCodecTest {
    @Test fun encodesTheGeneratorPointAndRestoresItsSecret() {
        val hex = "0".repeat(63) + "1"
        val nsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl"
        val secret = NostrKeyCodec.import(hex)
        assertEquals(nsec, NostrKeyCodec.nsec(secret))
        assertEquals(
            "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d",
            NostrKeyCodec.npub(secret),
        )
        assertArrayEquals(secret, NostrKeyCodec.import(" ${nsec.uppercase()} "))
    }

    @Test fun rejectsZeroOrderInvalidChecksumMixedCaseAndNonCanonicalPadding() {
        for (input in listOf(
            "0".repeat(64),
            "nsec1",
            "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d",
            "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
            "nsec1!qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl",
            "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgq",
            "Nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl",
            "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3xpt74d",
        )) {
            assertThrows(IllegalArgumentException::class.java) { NostrKeyCodec.import(input) }
        }
    }

    @Test fun rejectsInvalidRawScalarsBeforeEncodingOrDerivingPublicKeys() {
        for (secret in listOf(ByteArray(31), ByteArray(32))) {
            assertThrows(IllegalArgumentException::class.java) { NostrKeyCodec.nsec(secret) }
            assertThrows(IllegalArgumentException::class.java) { NostrKeyCodec.publicKey(secret) }
        }
    }

    @Test fun generatedKeysRoundTripAndAreIndependent() {
        val first = NostrKeyCodec.generate()
        val second = NostrKeyCodec.generate()
        assertArrayEquals(first, NostrKeyCodec.import(NostrKeyCodec.nsec(first)))
        assertNotEquals(NostrKeyCodec.npub(first), NostrKeyCodec.npub(second))
    }
}
