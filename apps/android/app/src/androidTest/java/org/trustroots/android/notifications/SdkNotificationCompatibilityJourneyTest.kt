package org.trustroots.android.notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.BuildConfig
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.updates.ApkUpdateCheckResult
import org.trustroots.android.updates.AndroidPreviewRelease
import org.unifiedpush.android.connector.data.PushMessage

@RunWith(AndroidJUnit4::class)
class SdkNotificationCompatibilityJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val messagePreferences
        get() = context.getSharedPreferences(MESSAGE_PREFERENCES, Context.MODE_PRIVATE)
    private val sessionPreferences
        get() = context.getSharedPreferences(SESSION_PREFERENCES, Context.MODE_PRIVATE)
    private val updatePreferences
        get() = context.getSharedPreferences(UPDATE_PREFERENCES, Context.MODE_PRIVATE)
    private val notifications
        get() = context.getSystemService(NotificationManager::class.java)

    private var previousMessagePreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousSessionPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousUpdatePreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null
    private var previousUpdateNotification: Notification? = null
    private var messageNotificationId: Int? = null
    private var fixtureServer: ServerSocket? = null
    private val activeSocket = AtomicReference<Socket?>()
    private val fixtureFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null

    @Before
    fun saveAndIsolateState() {
        previousMessagePreferences = messagePreferences.all
        previousSessionPreferences = sessionPreferences.all
        previousUpdatePreferences = updatePreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        previousUpdateNotification = notifications.activeNotifications
            .firstOrNull { it.id == UPDATE_NOTIFICATION_ID }?.notification
        messagePreferences.edit().clear().commit()
        sessionPreferences.edit().clear().commit()
        updatePreferences.edit().clear().commit()
        MessageAlerts.destination.value = null
        MessageAlerts.status.value = null
        notifications.cancel(UPDATE_NOTIFICATION_ID)
    }

    @After
    fun restoreStateAndStopFixture() {
        val cleanupFailures = mutableListOf<Throwable>()
        fun captureCleanup(action: () -> Unit) {
            try {
                action()
            } catch (error: Throwable) {
                cleanupFailures += error
            }
        }

        captureCleanup { fixtureServer?.close() }
        captureCleanup { activeSocket.getAndSet(null)?.close() }
        captureCleanup { responder?.join(5_000) }
        captureCleanup { check(responder?.isAlive != true) { "Local release fixture did not stop" } }
        fixtureFailure.get()?.let { cleanupFailures += AssertionError("Local release fixture failed", it) }

        captureCleanup { messageNotificationId?.let(notifications::cancel) }
        captureCleanup {
            previousUpdateNotification?.let { notifications.notify(UPDATE_NOTIFICATION_ID, it) }
                ?: notifications.cancel(UPDATE_NOTIFICATION_ID)
        }
        captureCleanup { restorePreferences(messagePreferences, previousMessagePreferences) }
        captureCleanup { restorePreferences(sessionPreferences, previousSessionPreferences) }
        captureCleanup { restorePreferences(updatePreferences, previousUpdatePreferences) }
        captureCleanup { MessageAlerts.destination.value = previousDestination }
        captureCleanup { MessageAlerts.status.value = previousStatus }

        if (cleanupFailures.isNotEmpty()) {
            throw AssertionError("Could not fully restore notification journey state").also { error ->
                cleanupFailures.forEach(error::addSuppressed)
            }
        }
    }

    @Test
    fun messageAlertHonoursRuntimePermissionOnlyOnSdk33AndNewer() {
        val senderId = UUID.randomUUID().toString().replace("-", "").take(24)
        val notificationId = senderId.hashCode()
        messageNotificationId = notificationId
        val session = MemberSession("connect.sid=fictional-message-session", MobileMember("quiet-otter", "Quiet Otter"))
        SecureMobileSessionStore(context).save(session)
        messagePreferences.edit()
            .putString("account", session.member.username)
            .putBoolean("enabled", true)
            .commit()
        val permissionChecks = AtomicInteger()
        val deniedContext = deniedNotificationContext(permissionChecks)

        MessageAlerts.show(
            deniedContext,
            PushMessage("""{"senderId":"$senderId"}""".toByteArray(), decrypted = true),
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            assertTrue("MessageAlerts should check POST_NOTIFICATIONS", permissionChecks.get() > 0)
            assertNull("A denied permission must prevent posting", activeNotification(notificationId))
        } else {
            assertEquals("Pre-33 SDKs have no runtime notification permission check", 0, permissionChecks.get())
            val notification = awaitNotification(notificationId)
            assertNotNull("Message alerts should post when the permission does not exist", notification)
            assertEquals("Unread message", notification?.extras?.getString(Notification.EXTRA_TITLE))
            assertEquals(
                "You have an unread Trustroots conversation.",
                notification?.extras?.getString(Notification.EXTRA_TEXT),
            )
            assertNotNull("The message notification should open its conversation", notification?.contentIntent)
        }
    }

    @Test
    fun apkUpdateAlertChecksPermissionOnlyWhenAvailableAndPostsOnLegacySdk(): Unit = runBlocking {
        val server = ServerSocket(0).apply { soTimeout = 10_000 }
        fixtureServer = server
        val versionCode = BuildConfig.VERSION_CODE + 17
        val versionName = "Offline preview $versionCode"
        val tag = "android-preview-$versionCode"
        updatePreferences.edit().putBoolean(UPDATE_ENABLED, true).putInt(LAST_NOTIFIED, 0).commit()
        val permissionChecks = AtomicInteger()
        val deniedContext = deniedNotificationContext(permissionChecks)
        val requestLine = AtomicReference<String?>(null)
        val releaseBody = """[{"tag_name":"$tag","body":"Build $versionCode.","name":"$versionName","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-$versionCode.apk","size":456}]}]"""
        responder = thread(isDaemon = true, name = "offline-apk-release-fixture") {
            val socket = try {
                server.accept()
            } catch (_: SocketTimeoutException) {
                fixtureFailure.compareAndSet(null, SocketTimeoutException("Timed out waiting for the local release request"))
                return@thread
            } catch (error: SocketException) {
                if (!server.isClosed) fixtureFailure.compareAndSet(null, error)
                return@thread
            }
            activeSocket.set(socket)
            try {
                socket.use {
                    socket.soTimeout = 5_000
                    val input = socket.getInputStream().bufferedReader()
                    requestLine.set(input.readLine())
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val bytes = releaseBody.toByteArray(Charsets.UTF_8)
                    val output = socket.getOutputStream()
                    output.write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    output.write(bytes)
                    output.flush()
                }
            } catch (error: IOException) {
                if (!server.isClosed) fixtureFailure.compareAndSet(null, error)
            } finally {
                activeSocket.compareAndSet(socket, null)
            }
        }

        val releasesUrl = "http://127.0.0.1:${server.localPort}/fixture/releases"
        val result = ApkUpdateAlerts.checkNow(deniedContext, previewAlertsEnabled = true, releasesUrl = releasesUrl)
        responder?.join(5_000)
        assertFalse("The local HTTP responder should finish", responder?.isAlive == true)
        assertNull("The local HTTP responder should not fail", fixtureFailure.get())
        assertEquals("GET /fixture/releases HTTP/1.1", requestLine.get())
        assertEquals(
            ApkUpdateCheckResult.NewVersion(
                AndroidPreviewRelease(
                    versionCode = versionCode,
                    versionName = versionName,
                    pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/$tag",
                ),
            ),
            result,
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            assertTrue("APK update alerts should check POST_NOTIFICATIONS", permissionChecks.get() > 0)
            assertNull("A denied permission must prevent posting", activeNotification(UPDATE_NOTIFICATION_ID))
            assertEquals("A denied notification must not be marked as shown", 0, updatePreferences.getInt(LAST_NOTIFIED, 0))
        } else {
            assertEquals("Pre-33 SDKs have no runtime notification permission check", 0, permissionChecks.get())
            val notification = awaitNotification(UPDATE_NOTIFICATION_ID)
            assertNotNull("APK update alerts should post when the permission does not exist", notification)
            assertEquals("Trustroots update available", notification?.extras?.getString(Notification.EXTRA_TITLE))
            assertEquals("$versionName is ready to download.", notification?.extras?.getString(Notification.EXTRA_TEXT))
            assertNotNull("The update notification should link to its release", notification?.contentIntent)
            assertEquals(versionCode, updatePreferences.getInt(LAST_NOTIFIED, 0))
        }
    }

    private fun deniedNotificationContext(permissionChecks: AtomicInteger): Context =
        object : ContextWrapper(context) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) {
                    permissionChecks.incrementAndGet()
                    PackageManager.PERMISSION_DENIED
                } else {
                    super.checkSelfPermission(permission)
                }

            override fun checkPermission(permission: String, pid: Int, uid: Int): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) {
                    permissionChecks.incrementAndGet()
                    PackageManager.PERMISSION_DENIED
                } else {
                    super.checkPermission(permission, pid, uid)
                }
        }

    private fun activeNotification(id: Int): Notification? =
        notifications.activeNotifications.firstOrNull { it.id == id }?.notification

    private fun awaitNotification(id: Int): Notification? {
        val deadline = SystemClock.elapsedRealtime() + 5_000
        var notification = activeNotification(id)
        while (notification == null && SystemClock.elapsedRealtime() < deadline) {
            Thread.sleep(25)
            notification = activeNotification(id)
        }
        return notification
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
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }

    private companion object {
        const val MESSAGE_PREFERENCES = "message-alerts"
        const val SESSION_PREFERENCES = "mobile-session"
        const val UPDATE_PREFERENCES = "apk-update-alerts"
        const val UPDATE_ENABLED = "enabled"
        const val LAST_NOTIFIED = "last-notified-version-code"
        const val UPDATE_NOTIFICATION_ID = 701
    }
}
