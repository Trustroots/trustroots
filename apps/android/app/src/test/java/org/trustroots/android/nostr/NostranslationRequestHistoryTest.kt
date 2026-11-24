package org.trustroots.android.nostr

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NostranslationRequestHistoryTest {
    private val initialTime = 1_800_000_000L

    @Test fun recognisesDuplicateRequestsForEachPeerUntilTheWindowExpires() {
        val history = NostranslationRequestHistory()
        assertTrue(history.record("first-peer", "request", initialTime))
        assertTrue(history.record("second-peer", "request", initialTime))
        assertFalse(history.record("first-peer", "request", initialTime + 120))
        assertTrue(history.record("first-peer", "request", initialTime + 121))
        assertFalse(history.record("first-peer", "request", initialTime + 121))
    }

    @Test fun rejectsNewRequestsWhenFullUntilAnEntryExpires() {
        val history = NostranslationRequestHistory()
        assertTrue(history.record("first-peer", "earliest", initialTime))
        repeat(255) { index ->
            assertTrue(history.record("second-peer", "request-$index", initialTime + 1))
        }
        assertFalse(history.record("second-peer", "overflow", initialTime + 120))
        assertTrue(history.record("second-peer", "overflow", initialTime + 121))
        assertFalse(history.record("second-peer", "another-overflow", initialTime + 121))
        assertTrue(history.record("second-peer", "another-overflow", initialTime + 122))
    }
}
