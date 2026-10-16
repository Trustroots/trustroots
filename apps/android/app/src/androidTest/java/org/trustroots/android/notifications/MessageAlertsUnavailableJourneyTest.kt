package org.trustroots.android.notifications

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.LocalTransportFixture

@RunWith(AndroidJUnit4::class)
class MessageAlertsUnavailableJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences: android.content.SharedPreferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private var fixture: LocalTransportFixture? = null

    @Before fun saveState() {
        previousPreferences = preferences.all
        previousStatus = MessageAlerts.status.value
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
    }

    @After fun restoreState() {
        try {
            fixture?.close()
        } finally {
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
            MessageAlerts.status.value = previousStatus
        }
    }

    @Test fun enableReportsUnavailableConfigurationWithoutChangingAccountOrChoosingDistributor() {
        val api = unavailableApi().also { fixture = it }
        val session = MemberSession("connect.sid=fixture-session", MobileMember("quiet-fox", "Quiet Fox"))
        preferences.edit().putString("account", "silver-otter").putBoolean("enabled", true)
            .putString("endpoint", "https://push.invalid/previous").commit()
        MessageAlerts.status.value = "Previous alert status"

        val result = AtomicReference<String>()
        val resultDelivered = CountDownLatch(1)
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                MessageAlerts.enable(
                    activity = activity,
                    session = session,
                    onResult = { result.set(it); resultDelivered.countDown() },
                    apiBaseUrl = api.baseURL,
                    hasDistributors = { error("Distributor lookup must not run after the API failure") },
                    chooseDistributor = { error("Distributor selection must not run after the API failure") },
                    registerDistributor = { error("Registration must not run after the API failure") },
                )
            }

            assertTrue("Enable did not report the failed configuration request", resultDelivered.await(10, TimeUnit.SECONDS))
        }

        assertCompletedRequest(api)
        assertEquals("Message alerts are not configured on this server.", result.get())
        assertEquals("silver-otter", preferences.getString("account", null))
        assertTrue(preferences.getBoolean("enabled", false))
        assertEquals("https://push.invalid/previous", MessageAlerts.endpoint(context))
        assertEquals("Previous alert status", MessageAlerts.status.value)
    }

    @Test fun reconcileStopsAfterUnavailableConfigurationAndPreservesEnabledAccountState() {
        val api = unavailableApi().also { fixture = it }
        val session = MemberSession("connect.sid=fixture-session", MobileMember("quiet-fox", "Quiet Fox"))
        preferences.edit().putString("account", session.member.username).putBoolean("enabled", true)
            .putString("endpoint", "https://push.invalid/previous").commit()
        MessageAlerts.status.value = "Previous alert status"
        var distributorLookups = 0
        var registrations = 0

        val job = MessageAlerts.reconcile(
            context = context,
            session = session,
            apiBaseUrl = api.baseURL,
            hasSavedDistributor = { distributorLookups++; true },
            registerDistributor = { registrations++ },
        )
        assertTrue("Enabled alerts should start a reconciliation request", job != null)
        runBlocking { withTimeout(10_000) { job!!.join() } }

        assertCompletedRequest(api)
        assertEquals(0, distributorLookups)
        assertEquals(0, registrations)
        assertTrue(MessageAlerts.isEnabled(context, session.member.username))
        assertEquals("https://push.invalid/previous", MessageAlerts.endpoint(context))
        assertEquals("Previous alert status", MessageAlerts.status.value)
        assertTrue("The API failure must not clear the user's enabled preference", preferences.getBoolean("enabled", false))
    }

    private fun unavailableApi() = LocalTransportFixture {
        LocalTransportFixture.Response("""{"message":"Fictional service unavailable."}""", status = 503)
    }

    private fun assertCompletedRequest(api: LocalTransportFixture) {
        val request = api.requests.single()
        assertEquals("GET", request.method)
        assertEquals("/api/users/unified-push", request.path)
        assertEquals("connect.sid=fixture-session", request.cookie)
    }

    private companion object {
        const val PREFERENCES_NAME = "message-alerts"
    }
}
