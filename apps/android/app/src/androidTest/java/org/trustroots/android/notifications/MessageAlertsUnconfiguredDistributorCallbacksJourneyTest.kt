package org.trustroots.android.notifications

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.unifiedpush.android.connector.data.PublicKeySet
import org.unifiedpush.android.connector.data.PushEndpoint

@RunWith(AndroidJUnit4::class)
class MessageAlertsUnconfiguredDistributorCallbacksJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null

    @Before fun isolateAlertState() {
        previousPreferences = preferences.all
        previousStatus = MessageAlerts.status.value
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
    }

    @After fun restoreAlertState() {
        try {
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
        } finally {
            MessageAlerts.status.value = previousStatus
        }
    }

    @Test fun lateEndpointForAnUnconfiguredAccountIsIgnored() {
        MessageAlerts.status.value = "No account is listening for this distributor."
        val sessionLoads = AtomicInteger()

        MessageAlerts.onEndpoint(
            context,
            PushEndpoint(
                "https://push.invalid/stale-endpoint",
                PublicKeySet("fictional-public-key", "fictional-auth-key"),
                temporary = false,
            ),
            apiBaseUrl = "http://127.0.0.1:1",
            loadSession = { sessionLoads.incrementAndGet(); null },
        )

        assertEquals(0, sessionLoads.get())
        assertEquals(emptyMap<String, Any>(), preferences.all)
        assertNull(MessageAlerts.endpoint(context))
        assertEquals("No account is listening for this distributor.", MessageAlerts.status.value)
    }

    @Test fun unregistrationForAnUnconfiguredAccountDoesNotClearStatusOrLoadSession() {
        MessageAlerts.status.value = "The current account has no distributor registration."
        val sessionLoads = AtomicInteger()

        val job = MessageAlerts.onDistributorUnregistered(
            context,
            apiBaseUrl = "http://127.0.0.1:1",
            loadSession = { sessionLoads.incrementAndGet(); null },
        )

        assertNull(job)
        assertEquals(0, sessionLoads.get())
        assertEquals(emptyMap<String, Any>(), preferences.all)
        assertNull(MessageAlerts.endpoint(context))
        assertEquals("The current account has no distributor registration.", MessageAlerts.status.value)
    }

    private companion object {
        const val PREFERENCES_NAME = "message-alerts"
    }
}
