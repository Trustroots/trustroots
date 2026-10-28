package org.trustroots.android.notifications

import android.content.Intent
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MessageAlertsIntentTest {
    @After
    fun clearDestination() {
        MessageAlerts.clearDestination()
    }

    @Test
    fun capturesOnlyCompleteDestinationsAndLeavesCurrentDestinationForIncompleteIntents() {
        val expected = MessageDestination("quiet-fox", "fictional-sender")
        MessageAlerts.captureIntent(
            Intent()
                .putExtra(MessageAlerts.ACCOUNT_EXTRA, expected.account)
                .putExtra(MessageAlerts.SENDER_EXTRA, expected.senderId),
        )
        assertEquals(expected, MessageAlerts.destination.value)

        MessageAlerts.captureIntent(Intent().putExtra(MessageAlerts.ACCOUNT_EXTRA, "calm-lynx"))
        MessageAlerts.captureIntent(Intent().putExtra(MessageAlerts.SENDER_EXTRA, "another-sender"))
        MessageAlerts.captureIntent(null)

        assertEquals(expected, MessageAlerts.destination.value)
        MessageAlerts.clearDestination()
        assertNull(MessageAlerts.destination.value)
    }
}
