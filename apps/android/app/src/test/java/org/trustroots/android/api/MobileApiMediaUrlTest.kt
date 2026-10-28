package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiMediaUrlTest {
    @Test
    fun encodesCircleSlugsAsSinglePathSegmentsAndBuildsBothImageSizes() {
        val api = MobileApiClient("https://api.example.test/")

        assertEquals(
            "https://api.example.test/uploads-circle/coastal%20travellers%2Ffictional/120x120.jpg",
            api.circleImageURL("coastal travellers/fictional").toString(),
        )
        assertEquals(
            "https://api.example.test/uploads-circle/coastal%20travellers%2Ffictional/742x496.jpg",
            api.circleHeroURL("coastal travellers/fictional").toString(),
        )
    }
}
