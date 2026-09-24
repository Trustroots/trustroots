package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CachePolicyTest {
    @Test fun keepsOnlySelectedAuthenticatedReads() {
        assertEquals("map" to 4, cachePolicy("/api/offers?southWestLat=1", "quiet-fox"))
        assertEquals("inbox" to 3, cachePolicy("/api/messages?page=1&limit=50", "quiet-fox"))
        assertEquals("thread" to 12, cachePolicy("/api/messages/member-one?limit=100", "quiet-fox"))
        assertEquals("own-profile" to 1, cachePolicy("/api/users/quiet-fox", "quiet-fox"))
        assertEquals("profile" to 8, cachePolicy("/api/users/calm-lynx", "quiet-fox"))
        assertNull(cachePolicy("/api/users?search=someone", "quiet-fox"))
    }
}
