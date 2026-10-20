package org.trustroots.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.trustroots.android.R

/** Android resource processing must preserve the API's hosting-decision markup. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "en")
class QuickReplyResourcesTest {
    @Test fun hostingRepliesPreserveTheirWireMarkup() {
        val resources = RuntimeEnvironment.getApplication().resources
        assertEquals(
            """<p data-hosting="yes"><b><i>Yes, I can host!</i></b></p>""",
            resources.getString(R.string.screen_quick_reply_host_yes_html),
        )
        assertEquals(
            """<p data-hosting="no"><b><i>Sorry I can't host</i></b></p>""",
            resources.getString(R.string.screen_quick_reply_host_no_html),
        )
    }
}
