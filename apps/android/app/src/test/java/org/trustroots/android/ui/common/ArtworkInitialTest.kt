package org.trustroots.android.ui.common

import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class ArtworkInitialTest {
    @Test fun initialsPreserveEmptyLabelsAndUnicodeUppercaseExpansion() {
        assertEquals("", artworkInitial(""))
        assertEquals("Q", artworkInitial("quiet heron"))
        assertEquals("SS", artworkInitial("ßample"))
        assertEquals(" ", artworkInitial(" leading space"))
    }
}
