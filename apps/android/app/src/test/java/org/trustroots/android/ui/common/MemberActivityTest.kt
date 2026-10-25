package org.trustroots.android.ui.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.trustroots.android.R

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MemberActivityTest {
    @Test
    fun futureLastActiveTimestampUsesLocalisedRecentlyFallback() {
        val context = RuntimeEnvironment.getApplication()
        val now = 1_800_000_000_000L

        assertEquals(
            context.getString(R.string.profile_activity_recently),
            memberLastActiveLabel(context, now + 60_000L, now),
        )
    }

    @Test
    fun missingLastActiveTimestampHasNoLabel() {
        assertNull(memberLastActiveLabel(RuntimeEnvironment.getApplication(), null))
    }
}
