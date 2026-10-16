package org.trustroots.android.notifications

import android.content.Context
import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.ServiceTestRule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.unifiedpush.android.connector.FailedReason
import org.unifiedpush.android.connector.PushService
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage

@RunWith(AndroidJUnit4::class)
class MessagePushServiceCallbackJourneyTest {
    @get:Rule val serviceRule = ServiceTestRule()

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val messagePreferences
        get() = context.getSharedPreferences(MESSAGE_PREFERENCES, Context.MODE_PRIVATE)
    private var previousMessagePreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null

    @After fun restoreState() {
        restorePreferences(messagePreferences, previousMessagePreferences)
        MessageAlerts.status.value = previousStatus
    }

    @Test fun frameworkBoundServiceRoutesCallbacksWithoutCallingNetwork() {
        previousMessagePreferences = messagePreferences.all
        previousStatus = MessageAlerts.status.value
        messagePreferences.edit().clear().putString("account", "quiet-fox").putBoolean("enabled", true).commit()
        MessageAlerts.status.value = null

        val binder = serviceRule.bindService(Intent(context, MessagePushService::class.java)) as PushService.PushBinder
        val service = binder.getService() as MessagePushService
        service.onNewEndpoint(PushEndpoint("https://push.invalid/topic", null, temporary = false), "fixture-instance")
        assertEquals("This distributor did not provide Web Push encryption keys.", MessageAlerts.status.value)

        service.onMessage(PushMessage("not JSON".toByteArray(), decrypted = false), "fixture-instance")
        assertEquals("This distributor did not provide Web Push encryption keys.", MessageAlerts.status.value)
        service.onRegistrationFailed(FailedReason.NETWORK, "fixture-instance")
        assertEquals("Push distributor registration failed: NETWORK.", MessageAlerts.status.value)

        service.onUnregistered("fixture-instance")
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertEquals(
            "Your push distributor stopped message alerts. Choose one again to resume.",
            MessageAlerts.status.value,
        )
        assertNull(MessageAlerts.endpoint(context))
    }

    private fun restorePreferences(preferences: android.content.SharedPreferences, values: Map<String, *>) {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        values.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
            }
        }
        editor.commit()
    }

    private companion object {
        const val MESSAGE_PREFERENCES = "message-alerts"
    }
}
