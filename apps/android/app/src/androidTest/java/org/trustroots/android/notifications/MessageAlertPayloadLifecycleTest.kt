package org.trustroots.android.notifications

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.MainActivity
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.unifiedpush.android.connector.FailedReason
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class MessageAlertPayloadLifecycleTest {
    @get:Rule
    val notificationPermissionRule = GrantPermissionRule.grant(*notificationPermissionsToGrant())

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val messagePreferences
        get() = context.getSharedPreferences(MESSAGE_PREFERENCES, Context.MODE_PRIVATE)
    private val sessionPreferences
        get() = context.getSharedPreferences(SESSION_PREFERENCES, Context.MODE_PRIVATE)
    private val analyticsPreferences
        get() = context.getSharedPreferences(ANALYTICS_PREFERENCES, Context.MODE_PRIVATE)
    private val notifications
        get() = context.getSystemService(NotificationManager::class.java)
    private lateinit var previousMessagePreferences: Map<String, *>
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAnalyticsPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null

    @Before
    fun setUp() {
        previousMessagePreferences = messagePreferences.all
        previousSessionPreferences = sessionPreferences.all
        previousAnalyticsPreferences = analyticsPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        messagePreferences.edit().clear().commit()
        sessionPreferences.edit().clear().commit()
        MessageAlerts.status.value = null
    }

    @After
    fun restoreState() {
        restorePreferences(messagePreferences, previousMessagePreferences)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(analyticsPreferences, previousAnalyticsPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test
    fun endpointWithoutEncryptionKeysReportsTheDistributorProblem() {
        preferencesFor("quiet-fox", enabled = true)

        MessageAlerts.onEndpoint(context, PushEndpoint("https://push.invalid/topic", null, temporary = false))

        assertNull(MessageAlerts.endpoint(context))
        assertEquals(
            "This distributor did not provide Web Push encryption keys.",
            MessageAlerts.status.value,
        )
    }

    @Test
    fun endpointForDisabledAccountDoesNotReplaceStatusOrSaveAnEndpoint() {
        preferencesFor("quiet-fox", enabled = false)
        MessageAlerts.status.value = "Waiting for registration"

        MessageAlerts.onEndpoint(context, PushEndpoint("https://push.invalid/topic", null, temporary = false))

        assertEquals("Waiting for registration", MessageAlerts.status.value)
        assertNull(MessageAlerts.endpoint(context))
    }

    @Test
    fun failedDistributorRegistrationShowsItsReason() {
        MessagePushService().onRegistrationFailed(FailedReason.NETWORK, "anonymous-instance")

        assertEquals("Push distributor registration failed: NETWORK.", MessageAlerts.status.value)
    }

    @Test
    fun showIgnoresUndecryptedAndMalformedPushesWithoutPostingNotifications() {
        val senderId = "507f1f77bcf86cd799439012"
        val notificationStateBefore = notificationsFor(senderId)

        MessageAlerts.show(context, PushMessage(payload(senderId), decrypted = false))
        MessageAlerts.show(context, PushMessage("not JSON".toByteArray(), decrypted = true))

        assertEquals(notificationStateBefore, notificationsFor(senderId))
    }

    @Test
    fun showIgnoresAValidPushWhenNoMemberSessionIsStored() {
        val senderId = "507f1f77bcf86cd799439013"
        preferencesFor("quiet-fox", enabled = true)
        val notificationStateBefore = notificationsFor(senderId)

        MessageAlerts.show(context, PushMessage(payload(senderId), decrypted = true))

        assertEquals(notificationStateBefore, notificationsFor(senderId))
    }

    @Test
    fun showIgnoresAValidPushWhenItsAccountHasAlertsDisabled() {
        val senderId = "507f1f77bcf86cd799439014"
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fake-session", MobileMember("quiet-fox", "Quiet Fox")),
        )
        preferencesFor("quiet-fox", enabled = false)
        val notificationStateBefore = notificationsFor(senderId)

        MessageAlerts.show(context, PushMessage(payload(senderId), decrypted = true))

        assertEquals(notificationStateBefore, notificationsFor(senderId))
        assertFalse(MessageAlerts.isEnabled(context, "quiet-fox"))
        assertTrue(sessionPreferences.contains("payload"))
    }

    @Test
    fun showPostsANotificationThatRoutesToItsConversation() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val senderId = unusedSenderId()
        val notificationId = senderId.hashCode()
        var activity: Activity? = null

        try {
            assumeTrue("App notifications must be enabled for this device test", notifications.areNotificationsEnabled())

            SecureMobileSessionStore(context).save(
                MemberSession("connect.sid=fake-session", MobileMember("quiet-fox", "Quiet Fox")),
            )
            preferencesFor("quiet-fox", enabled = true)
            MessageAlerts.show(context, PushMessage(payload(senderId), decrypted = true))

            val posted = notifications.activeNotifications.firstOrNull { it.id == notificationId }
            assertNotNull(posted)
            val notification = requireNotNull(posted).notification
            assertEquals("Unread message", notification.extras.getString(android.app.Notification.EXTRA_TITLE))
            assertEquals(
                "You have an unread Trustroots conversation.",
                notification.extras.getString(android.app.Notification.EXTRA_TEXT),
            )
            assertTrue(notification.flags and android.app.Notification.FLAG_AUTO_CANCEL != 0)
            assertNotNull(notification.contentIntent)

            // Opening the destination must not cause a registration request or authenticated API call.
            SecureMobileSessionStore(context).clear()
            messagePreferences.edit().clear().commit()
            analyticsPreferences.edit().clear().commit()
            MessageAlerts.destination.value = null
            val monitor = android.app.Instrumentation.ActivityMonitor(MainActivity::class.java.name, null, false)
            instrumentation.addMonitor(monitor)
            try {
                notification.contentIntent!!.send()
                activity = monitor.waitForActivityWithTimeout(5_000)
                assertNotNull(activity)
                instrumentation.waitForIdleSync()
                assertEquals(MessageDestination("quiet-fox", senderId), MessageAlerts.destination.value)
            } finally {
                instrumentation.removeMonitor(monitor)
                instrumentation.runOnMainSync { activity?.finish() }
            }
        } finally {
            notifications.cancel(notificationId)
        }
    }

    private fun preferencesFor(account: String, enabled: Boolean) {
        messagePreferences.edit()
            .putString("account", account)
            .putBoolean("enabled", enabled)
            .commit()
    }

    private fun notificationsFor(senderId: String): List<String> =
        notifications.activeNotifications
            .filter { it.id == senderId.hashCode() }
            .map { it.key }

    private fun restorePreferences(
        preferences: android.content.SharedPreferences,
        values: Map<String, *>,
    ) {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        values.forEach { (key, value) ->
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
    }

    private fun payload(senderId: String) = """{"senderId":"$senderId"}""".toByteArray()

    private fun unusedSenderId(): String {
        while (true) {
            val senderId = UUID.randomUUID().toString().replace("-", "").take(24)
            if (notifications.activeNotifications.none { it.id == senderId.hashCode() }) return senderId
        }
    }

    private fun notificationPermissionsToGrant(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray()
        }

    private companion object {
        const val MESSAGE_PREFERENCES = "message-alerts"
        const val SESSION_PREFERENCES = "mobile-session"
        const val ANALYTICS_PREFERENCES = "usage-analytics"
    }
}
