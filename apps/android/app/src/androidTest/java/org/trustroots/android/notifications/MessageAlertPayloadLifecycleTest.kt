package org.trustroots.android.notifications

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import android.os.SystemClock
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
import org.trustroots.android.R
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.MainActivity
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.nostr.nostrAccountScope
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
            "Your notification app could not set up secure message alerts. Update it or choose another notification app, then turn alerts off and back on in Account → Message alerts.",
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
    fun failedDistributorRegistrationShowsRecoveryInstructions() {
        val service = pushService()
        service.onRegistrationFailed(FailedReason.NETWORK, "anonymous-instance")

        assertEquals("Could not turn on message alerts. Try again in Account → Message alerts.", MessageAlerts.status.value)
        assertEquals(
            MessageAlertStatusMetadata(R.string.message_alerts_registration_error),
            MessageAlerts.statusMetadata.value,
        )
    }

    @Test
    fun nostranslationDistributorFailuresStaySeparateFromMessageAlerts() {
        val previousStatus = NostranslationAlerts.status.value
        try {
            val service = pushService()
            val instance = NostranslationAlerts.instance
            service.onNewEndpoint(PushEndpoint("https://push.invalid/review", null, temporary = false), instance)
            assertEquals(R.string.nostranslation_alerts_unavailable, NostranslationAlerts.status.value)
            NostranslationAlerts.status.value = null
            service.onRegistrationFailed(FailedReason.NETWORK, instance)
            assertEquals(R.string.nostranslation_alerts_unavailable, NostranslationAlerts.status.value)
            NostranslationAlerts.status.value = null
            service.onUnregistered(instance)
            assertEquals(R.string.nostranslation_alerts_unavailable, NostranslationAlerts.status.value)
            assertNull(MessageAlerts.status.value)
        } finally {
            NostranslationAlerts.status.value = previousStatus
        }
    }

    @Test
    fun nostranslationReviewNotificationsRequireADecryptedPushAndTheOptedInAccount() {
        assumeTrue("App notifications must be enabled for this device test", notifications.areNotificationsEnabled())
        val instance = NostranslationAlerts.instance
        val preferences = context.getSharedPreferences("nostranslation-alerts", Context.MODE_PRIVATE)
        val savedPreferences = preferences.all
        val backend = "http://127.0.0.1:1"
        val member = MobileMember("quiet-fox", "Quiet Fox")
        val store = SecureMobileSessionStore(context)
        val service = pushService()
        val payload = """{"type":"nostranslation-review"}""".toByteArray()
        val review = PushMessage(payload, decrypted = true)
        notifications.cancel(instance, 0)

        try {
            preferences.edit().clear().commit()
            service.onMessage(review, instance)
            store.save(MemberSession("connect.sid=fake-session", member))
            service.onMessage(review, instance)
            preferences.edit().putString("backend", backend).commit()
            val otherAccount = nostrAccountScope(backend, "other-member").storageAccount
            preferences.edit().putBoolean(otherAccount, true).commit()
            service.onMessage(review, instance)

            val account = nostrAccountScope(backend, member.username).storageAccount
            preferences.edit().putBoolean(account, true).commit()
            service.onMessage(PushMessage(payload, decrypted = false), instance)
            service.onMessage(PushMessage("not JSON".toByteArray(), decrypted = true), instance)
            service.onMessage(PushMessage("""{"type":"other"}""".toByteArray(), decrypted = true), instance)
            assertFalse(notifications.activeNotifications.any { it.tag == instance })

            service.onMessage(review, instance)
            val deadline = SystemClock.elapsedRealtime() + 5_000
            var posted = notifications.activeNotifications.firstOrNull { it.tag == instance }
            while (posted == null && SystemClock.elapsedRealtime() < deadline) {
                Thread.sleep(25)
                posted = notifications.activeNotifications.firstOrNull { it.tag == instance }
            }
            val notification = requireNotNull(posted).notification
            assertEquals(instance, notification.channelId)
            assertEquals(context.getString(R.string.nostranslation_review_waiting), notification.extras.getCharSequence("android.text"))
            assertEquals(context.packageName, notification.contentIntent.creatorPackage)
        } finally {
            notifications.cancel(instance, 0)
            restorePreferences(preferences, savedPreferences)
        }
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
    fun testPushPostsADistinctNotificationWithoutOpeningAConversation() {
        assumeTrue("App notifications must be enabled for this device test", notifications.areNotificationsEnabled())
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fake-session", MobileMember("quiet-fox", "Quiet Fox")),
        )
        preferencesFor("quiet-fox", enabled = true)

        try {
            MessageAlerts.show(context, PushMessage("""{"test":true}""".toByteArray(), decrypted = true))

            val deadline = SystemClock.elapsedRealtime() + 5_000
            var alert = notifications.activeNotifications.firstOrNull { it.tag == "message-alert-test" }
            while (alert == null && SystemClock.elapsedRealtime() < deadline) {
                Thread.sleep(25)
                alert = notifications.activeNotifications.firstOrNull { it.tag == "message-alert-test" }
            }
            val notification = requireNotNull(alert).notification
            assertEquals("Trustroots test notification", notification.extras.getString(android.app.Notification.EXTRA_TITLE))
            assertNull(notification.contentIntent)
        } finally {
            notifications.cancel("message-alert-test", 0)
        }
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

            val notificationDeadline = SystemClock.elapsedRealtime() + 5_000
            var posted = notifications.activeNotifications.firstOrNull { it.id == notificationId }
            while (posted == null && SystemClock.elapsedRealtime() < notificationDeadline) {
                Thread.sleep(25)
                posted = notifications.activeNotifications.firstOrNull { it.id == notificationId }
            }
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

    private fun pushService(): MessagePushService = MessagePushService().also { service ->
        // Framework-created services have an attached base Context for resource access.
        ContextWrapper::class.java.getDeclaredMethod("attachBaseContext", Context::class.java).apply {
            isAccessible = true
        }.invoke(service, context)
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
