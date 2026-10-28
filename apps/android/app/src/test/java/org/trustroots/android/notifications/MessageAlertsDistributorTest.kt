package org.trustroots.android.notifications

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MessageAlertsDistributorTest {
    private val context = RuntimeEnvironment.getApplication()
    private val preferences = context.getSharedPreferences("message-alerts", 0)

    @Test
    fun distributorRemovalClearsEnabledStateAndSkipsUnregisterForAnotherAccount() = runBlocking {
        preferences.edit()
            .putString("account", "quiet-fox")
            .putBoolean("enabled", true)
            .putString("endpoint", "https://push.example.test/fictional-endpoint")
            .apply()
        MessageAlerts.status.value = "A stale status"
        MessageAlerts.statusMetadata.value = MessageAlertStatusMetadata(R.string.message_alerts_ready)
        var sessionLookups = 0

        val job = MessageAlerts.onDistributorUnregistered(
            context = context,
            apiBaseUrl = "http://127.0.0.1:1",
            loadSession = {
                sessionLookups++
                MemberSession("fictional-session", MobileMember("calm-lynx", "Calm Lynx"))
            },
        )
        job?.join()

        assertEquals(1, sessionLookups)
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertNull(MessageAlerts.endpoint(context))
        assertEquals(context.getString(R.string.message_alerts_distributor_stopped), MessageAlerts.status.value)
        assertEquals(
            MessageAlertStatusMetadata(R.string.message_alerts_distributor_stopped),
            MessageAlerts.statusMetadata.value,
        )
    }

    @Test
    fun distributorRemovalWithoutSavedEndpointDoesNotLoadSession() {
        preferences.edit().clear().putString("account", "quiet-fox").putBoolean("enabled", true).apply()
        var sessionLookups = 0

        val job = MessageAlerts.onDistributorUnregistered(
            context = context,
            apiBaseUrl = "http://127.0.0.1:1",
            loadSession = {
                sessionLookups++
                MemberSession("fictional-session", MobileMember("quiet-fox", "Quiet Fox"))
            },
        )

        assertNull(job)
        assertEquals(0, sessionLookups)
        assertTrue(MessageAlerts.isEnabled(context, "quiet-fox").not())
        assertNull(MessageAlerts.endpoint(context))
    }
}
