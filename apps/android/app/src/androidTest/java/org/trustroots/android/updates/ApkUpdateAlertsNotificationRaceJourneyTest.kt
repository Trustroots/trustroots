package org.trustroots.android.updates

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.TimeUnit
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
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.BuildConfig

@RunWith(AndroidJUnit4::class)
class ApkUpdateAlertsNotificationRaceJourneyTest {
    @get:Rule val notificationPermissionRule = GrantPermissionRule.grant(*notificationPermissionsToGrant())

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val notifications
        get() = context.getSystemService(NotificationManager::class.java)
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousNotification: Notification? = null
    private var server: ServerSocket? = null
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @Before fun saveState() {
        previousPreferences = preferences.all
        previousNotification = notifications.activeNotifications
            .firstOrNull { it.id == NOTIFICATION_ID }?.notification
        notifications.cancel(NOTIFICATION_ID)
        preferences.edit().clear()
            .putBoolean("enabled", true)
            .putInt(LAST_NOTIFIED_VERSION, BuildConfig.VERSION_CODE)
            .commit()
    }

    @After fun restoreState() {
        try {
            server?.close()
        } finally {
            try {
                activeSocket?.close()
            } finally {
                try {
                    responder?.join(1_000)
                } finally {
                    try {
                        previousNotification?.let { notifications.notify(NOTIFICATION_ID, it) }
                            ?: notifications.cancel(NOTIFICATION_ID)
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
                    }
                }
            }
        }
    }

    @Test fun securityExceptionDoesNotRecordVersionAndAllowsRetry(): Unit = runBlocking {
        assumeTrue("Device notifications must be enabled for this journey", notifications.areNotificationsEnabled())

        val fixtureServer = ServerSocket(0).also {
            it.soTimeout = TimeUnit.SECONDS.toMillis(8).toInt()
            server = it
        }
        val versionCode = BuildConfig.VERSION_CODE + 19
        val versionName = "Offline preview $versionCode"
        val tag = "android-preview-$versionCode"
        val body = """[{"tag_name":"$tag","body":"Build $versionCode.","name":"$versionName","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-$versionCode.apk","size":456}]}]"""
        val requestCount = AtomicInteger()
        val responderFailure = AtomicReference<Throwable?>()
        responder = thread(isDaemon = true) {
            try {
                repeat(2) {
                    val socket = fixtureServer.accept()
                    activeSocket = socket
                    try {
                        socket.soTimeout = 5_000
                        socket.use {
                            val input = socket.getInputStream().bufferedReader()
                            if (input.readLine() == null) throw EOFException("Missing HTTP request line")
                            while (true) {
                                val header = input.readLine() ?: throw EOFException("Incomplete HTTP headers")
                                if (header.isEmpty()) break
                            }
                            requestCount.incrementAndGet()
                            val bytes = body.toByteArray(Charsets.UTF_8)
                            socket.getOutputStream().write(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                            )
                            socket.getOutputStream().write(bytes)
                            socket.getOutputStream().flush()
                        }
                    } finally {
                        activeSocket = null
                    }
                }
            } catch (error: IOException) {
                if (!fixtureServer.isClosed) responderFailure.set(error)
            } catch (error: Throwable) {
                responderFailure.set(error)
            }
        }
        val releasesUrl = "http://127.0.0.1:${fixtureServer.localPort}/fixture/releases"
        val failedPosts = AtomicInteger()

        val firstResult = ApkUpdateAlerts.checkNow(
            context,
            previewAlertsEnabled = true,
            releasesUrl = releasesUrl,
        ) { manager, id, notification ->
            assertEquals(NOTIFICATION_ID, id)
            assertNotNull(manager)
            assertNotNull(notification)
            failedPosts.incrementAndGet()
            throw SecurityException("Simulated permission revocation during notify")
        }

        assertEquals(
            ApkUpdateCheckResult.NewVersion(
                AndroidPreviewRelease(
                    versionCode,
                    versionName,
                    "https://github.com/Trustroots/trustroots/releases/tag/$tag",
                ),
            ),
            firstResult,
        )
        assertEquals(1, failedPosts.get())
        assertEquals(BuildConfig.VERSION_CODE, preferences.getInt(LAST_NOTIFIED_VERSION, 0))
        assertFalse(notifications.activeNotifications.any { it.id == NOTIFICATION_ID })

        val successfulPosts = AtomicInteger()
        val retryResult = ApkUpdateAlerts.checkNow(
            context,
            previewAlertsEnabled = true,
            releasesUrl = releasesUrl,
        ) { manager, id, notification ->
            manager.notify(id, notification)
            successfulPosts.incrementAndGet()
        }

        assertEquals(firstResult, retryResult)
        assertEquals(1, successfulPosts.get())
        assertEquals(versionCode, preferences.getInt(LAST_NOTIFIED_VERSION, 0))
        waitForNotification()
        val published = notifications.activeNotifications.single { it.id == NOTIFICATION_ID }.notification
        assertEquals("Trustroots update available", published.extras.getString(Notification.EXTRA_TITLE))
        assertEquals("$versionName is ready to download.", published.extras.getString(Notification.EXTRA_TEXT))
        assertNotNull(published.contentIntent)

        responder?.join(2_000)
        assertFalse("Local fixture responder should finish both requests", responder?.isAlive == true)
        assertNull("Local fixture responder failed", responderFailure.get())
        assertEquals(2, requestCount.get())
    }

    private fun waitForNotification() {
        val deadline = SystemClock.elapsedRealtime() + TimeUnit.SECONDS.toMillis(5)
        while (SystemClock.elapsedRealtime() < deadline &&
            notifications.activeNotifications.none { it.id == NOTIFICATION_ID }
        ) Thread.sleep(25)
        assertTrue(notifications.activeNotifications.any { it.id == NOTIFICATION_ID })
    }

    private fun notificationPermissionsToGrant(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray()
        }

    private companion object {
        const val PREFERENCES_NAME = "apk-update-alerts"
        const val LAST_NOTIFIED_VERSION = "last-notified-version-code"
        const val NOTIFICATION_ID = 701
    }
}
