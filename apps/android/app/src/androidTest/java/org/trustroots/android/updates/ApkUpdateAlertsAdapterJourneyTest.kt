package org.trustroots.android.updates

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
import androidx.test.rule.GrantPermissionRule
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.BuildConfig

@RunWith(AndroidJUnit4::class)
class ApkUpdateAlertsAdapterJourneyTest {
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
        preferences.edit().clear().putBoolean("enabled", true).commit()
    }

    @After fun restoreState() {
        try {
            server?.close()
        } finally {
            try {
                activeSocket?.close()
            } finally {
                responder?.join(1_000)
            }
        }
        previousNotification?.let { notifications.notify(NOTIFICATION_ID, it) }
            ?: notifications.cancel(NOTIFICATION_ID)
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        previousPreferences.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
            }
        }
        editor.commit()
    }

    @Test fun checkFetchesAndPublishesAnUpdateFromLocalReleaseFixture(): Unit = runBlocking {
        assumeTrue("Device notifications must be enabled for this adapter journey", notifications.areNotificationsEnabled())
        assumeTrue("Permission-denial handling is available on Android 13 and newer", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        val fixtureServer = ServerSocket(0).also { server = it }
        val versionCode = BuildConfig.VERSION_CODE + 1
        val versionName = "Offline preview $versionCode"
        val tag = "android-preview-$versionCode"
        fun payload(version: Int, name: String) =
            """[{"tag_name":"android-preview-$version","body":"Build $version.","name":"$name","draft":false,"prerelease":true,"assets":[{"name":"trustroots-android-$version.apk","size":123}]}]"""
        val fixtures = listOf(payload(versionCode, versionName), payload(versionCode + 1, "Next offline preview"))
        var requestLine = ""
        var headers = ""
        responder = thread(isDaemon = true) {
            var served = 0
            while (served < fixtures.size) {
                val socket = acceptOrStop(fixtureServer) ?: break
                activeSocket = socket
                try {
                    socket.use {
                        val input = socket.getInputStream().bufferedReader()
                        requestLine = input.readLine().orEmpty()
                        val capturedHeaders = StringBuilder()
                        while (true) {
                            val header = input.readLine().orEmpty()
                            if (header.isEmpty()) break
                            capturedHeaders.append(header).append('\n')
                        }
                        if (served == 0) headers = capturedHeaders.toString()
                        val bytes = fixtures[served].toByteArray()
                        socket.getOutputStream().write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        socket.getOutputStream().write(bytes)
                        socket.getOutputStream().flush()
                    }
                    served++
                } catch (error: IOException) {
                    if (fixtureServer.isClosed) break else throw error
                } finally {
                    activeSocket = null
                }
            }
        }

        val result = ApkUpdateAlerts.checkNow(
            context,
            previewAlertsEnabled = true,
            releasesUrl = "http://127.0.0.1:${fixtureServer.localPort}/fixture/releases",
        )
        responder?.join(2_000)

        assertEquals(
            ApkUpdateCheckResult.NewVersion(
                AndroidPreviewRelease(
                    versionCode,
                    versionName,
                    "https://github.com/Trustroots/trustroots/releases/tag/$tag",
                ),
            ),
            result,
        )
        assertTrue(requestLine.startsWith("GET /fixture/releases HTTP/1.1"))
        assertTrue(headers.contains("Accept: application/vnd.github+json"))
        assertTrue(headers.contains("User-Agent: TrustrootsAndroid/"))
        waitForNotification()
        val notification = notifications.activeNotifications.single { it.id == NOTIFICATION_ID }.notification
        assertEquals("Trustroots update available", notification.extras.getString(android.app.Notification.EXTRA_TITLE))
        assertEquals("$versionName is ready to download.", notification.extras.getString(android.app.Notification.EXTRA_TEXT))
        assertNotNull(notification.contentIntent)
        assertEquals(versionCode, preferences.getInt(LAST_NOTIFIED_VERSION, 0))

        val deniedNotificationContext = object : ContextWrapper(context) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) {
                    PackageManager.PERMISSION_DENIED
                } else {
                    super.checkSelfPermission(permission)
                }
        }
        val checkDenied = ApkUpdateAlerts.checkNow(
            deniedNotificationContext,
            previewAlertsEnabled = true,
            releasesUrl = "http://127.0.0.1:${fixtureServer.localPort}/fixture/releases",
        )
        assertTrue(checkDenied is ApkUpdateCheckResult.NewVersion)
        assertEquals(versionCode, preferences.getInt(LAST_NOTIFIED_VERSION, 0))
        assertEquals(
            "$versionName is ready to download.",
            notifications.activeNotifications.single { it.id == NOTIFICATION_ID }
                .notification.extras.getString(android.app.Notification.EXTRA_TEXT),
        )
        responder?.join(2_000)
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

    private fun acceptOrStop(listener: ServerSocket): Socket? = try {
        listener.accept()
    } catch (error: SocketException) {
        if (listener.isClosed) null else throw error
    }

    private companion object {
        const val PREFERENCES_NAME = "apk-update-alerts"
        const val LAST_NOTIFIED_VERSION = "last-notified-version-code"
        const val NOTIFICATION_ID = 701
    }
}
