package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Test

class MessageDraftStoreTest {
    @Test
    fun cacheKeyMatchesPhoneWebShape() {
        assertEquals(
            "messages.thread.steady-heron-quiet-fox",
            MessageDraftStore.cacheKey("steady-heron", "quiet-fox"),
        )
    }
}
