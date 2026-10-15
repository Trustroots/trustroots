package org.trustroots.android.notifications

import android.content.Context
import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MessageAlertsJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null

    @Before
    fun setUp() {
        previousPreferences = preferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        preferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After
    fun restoreState() {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        previousPreferences.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test
    fun savedAlertsBelongOnlyToTheSelectedAccount() {
        preferences.edit()
            .putString("account", "quiet-fox")
            .putBoolean("enabled", true)
            .commit()

        assertTrue(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertFalse(MessageAlerts.isEnabled(context, "calm-lynx"))
    }

    @Test
    fun notificationIntentOpensItsConversationAndIncompleteIntentDoesNotCreateOne() {
        val senderId = "507f1f77bcf86cd799439011"
        MessageAlerts.captureIntent(
            Intent()
                .putExtra(MessageAlerts.ACCOUNT_EXTRA, "quiet-fox")
                .putExtra(MessageAlerts.SENDER_EXTRA, senderId),
        )
        assertEquals(MessageDestination("quiet-fox", senderId), MessageAlerts.destination.value)

        MessageAlerts.clearDestination()
        MessageAlerts.captureIntent(Intent().putExtra(MessageAlerts.ACCOUNT_EXTRA, "quiet-fox"))
        MessageAlerts.captureIntent(null)

        assertNull(MessageAlerts.destination.value)
    }

    @Test
    fun distributorRemovalClearsLocalOptInAndExplainsHowToResume() {
        preferences.edit()
            .putString("account", "quiet-fox")
            .putBoolean("enabled", true)
            .commit()

        // With no saved endpoint, handling this lifecycle event stays local.
        MessageAlerts.onDistributorUnregistered(context)

        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertNull(MessageAlerts.endpoint(context))
        assertEquals(
            "Your push distributor stopped message alerts. Choose one again to resume.",
            MessageAlerts.status.value,
        )
    }

    @Test
    fun reconcilingADisabledAccountClearsStaleStatusWithoutRegistering() {
        MessageAlerts.status.value = "A previous registration message"

        MessageAlerts.reconcile(
            context,
            MemberSession(
                "connect.sid=fake-session",
                MobileMember("quiet-fox", "Quiet Fox"),
            ),
        )

        assertNull(MessageAlerts.status.value)
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
    }

    private companion object {
        const val PREFERENCES_NAME = "message-alerts"
    }
}
