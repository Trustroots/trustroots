package org.trustroots.android.api

import org.junit.Assert.assertNull
import org.junit.Test

class NostrootsGridRefinementValidationTest {
    @Test
    fun rejectsInvalidCharacterInGridRefinementAfterValidPairCode() {
        val event = """["EVENT","map",{"id":"${"a".repeat(64)}","pubkey":"${"b".repeat(64)}","sig":"${"c".repeat(128)}","kind":30397,"created_at":1700000000,"content":"A fictional note","tags":[["l","8FVC9G8F+5W!","open-location-code"]]}]"""

        assertNull(parseCommunityNote(event))
    }
}
