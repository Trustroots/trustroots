package org.trustroots.android.notifications

import android.Manifest
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.app.NotificationManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.unifiedpush.android.connector.data.PushMessage

@RunWith(AndroidJUnit4::class)
class MessageAlertPermissionAndUnregisterJourneyTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val messagePreferences
        get() = context.getSharedPreferences(MESSAGE_PREFERENCES, Context.MODE_PRIVATE)
    private val sessionPreferences
        get() = context.getSharedPreferences(SESSION_PREFERENCES, Context.MODE_PRIVATE)
    private val notifications
        get() = context.getSystemService(NotificationManager::class.java)
    private val server = ServerSocket(0).apply { soTimeout = 300 }
    private val requests = CopyOnWriteArrayList<String>()
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null
    private var previousMessagePreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousSessionPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private var previousDestination: MessageDestination? = null

    @Before fun saveAndClearState() {
        previousMessagePreferences = messagePreferences.all
        previousSessionPreferences = sessionPreferences.all
        previousStatus = MessageAlerts.status.value
        previousDestination = MessageAlerts.destination.value
        messagePreferences.edit().clear().commit()
        sessionPreferences.edit().clear().commit()
        MessageAlerts.status.value = null
        MessageAlerts.destination.value = null
    }

    @After fun restoreState() {
        server.close()
        activeSocket?.close()
        responder?.join(1_500)
        assertTrue("The local unregister responder should stop after server shutdown", responder?.isAlive != true)
        restorePreferences(messagePreferences, previousMessagePreferences)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        MessageAlerts.status.value = previousStatus
        MessageAlerts.destination.value = previousDestination
    }

    @Test fun showSkipsNotificationWhenPermissionCheckDeniesActiveAccount() {
        assumeTrue("POST_NOTIFICATIONS is checked on Android 13 and later", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        val session = fixtureSession("quiet-fox")
        SecureMobileSessionStore(context).save(session)
        messagePreferences.edit().putString("account", session.member.username).putBoolean("enabled", true).commit()
        val senderId = unusedSenderId()
        val notificationId = senderId.hashCode()
        val realPermissionBefore = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
        val deniedCheck = AtomicBoolean(false)
        val permissionDeniedContext = object : ContextWrapper(context) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) {
                    deniedCheck.set(true)
                    PackageManager.PERMISSION_DENIED
                } else {
                    super.checkSelfPermission(permission)
                }

            override fun checkPermission(permission: String, pid: Int, uid: Int): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) {
                    deniedCheck.set(true)
                    PackageManager.PERMISSION_DENIED
                } else {
                    super.checkPermission(permission, pid, uid)
                }
        }

        try {
            assertTrue(MessageAlerts.isEnabled(context, session.member.username))
            MessageAlerts.show(
                permissionDeniedContext,
                PushMessage("""{"senderId":"$senderId"}""".toByteArray(), decrypted = true),
            )

            assertTrue("The notification permission check should have been reached", deniedCheck.get())
            assertFalse(notifications.activeNotifications.any { it.id == notificationId })
            assertEquals(
                realPermissionBefore,
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS),
            )
        } finally {
            notifications.cancel(notificationId)
        }
    }

    @Test fun distributorUnregistrationClearsStateWithoutDeletingEndpointForUnavailableOrOtherAccount() {
        val baseUrl = "http://127.0.0.1:${server.localPort}"
        startResponder()

        seedEnabledEndpoint("quiet-fox")
        runBlocking {
            withTimeout(5_000) {
                requireNotNull(MessageAlerts.onDistributorUnregistered(context, baseUrl) { null }).join()
            }
        }
        assertUnregistrationStateCleared("quiet-fox")

        seedEnabledEndpoint("quiet-fox")
        runBlocking {
            withTimeout(5_000) {
                requireNotNull(
                    MessageAlerts.onDistributorUnregistered(context, baseUrl) { fixtureSession("amber-owl") },
                ).join()
            }
        }
        assertUnregistrationStateCleared("quiet-fox")

        assertTrue("Unregistration without a matching session must not call the local API", requests.isEmpty())
    }

    private fun seedEnabledEndpoint(account: String) {
        messagePreferences.edit()
            .putString("account", account)
            .putBoolean("enabled", true)
            .putString("endpoint", "http://127.0.0.1:${server.localPort}/fixture-endpoint")
            .commit()
        MessageAlerts.status.value = "Previous distributor status"
    }

    private fun assertUnregistrationStateCleared(account: String) {
        assertFalse(MessageAlerts.isEnabled(context, account))
        assertNull(MessageAlerts.endpoint(context))
        assertTrue(messagePreferences.all.isEmpty())
        assertEquals(
            "Your push distributor stopped message alerts. Choose one again to resume.",
            MessageAlerts.status.value,
        )
    }

    private fun fixtureSession(username: String) =
        MemberSession("connect.sid=fictional-session", MobileMember(username, "${username.replaceFirstChar { it.uppercase() }} Member"))

    private fun unusedSenderId(): String {
        while (true) {
            val senderId = UUID.randomUUID().toString().replace("-", "").take(24)
            if (notifications.activeNotifications.none { it.id == senderId.hashCode() }) return senderId
        }
    }

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "message-unregister-local-api") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket = socket
                try {
                    socket.use { connection ->
                        connection.soTimeout = 1_000
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine() ?: break
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val body = CharArray(contentLength)
                        var bodyOffset = 0
                        while (bodyOffset < body.size) {
                            val count = input.read(body, bodyOffset, body.size - bodyOffset)
                            if (count < 0) throw java.io.EOFException("Local API request ended before its declared body length")
                            bodyOffset += count
                        }
                        requests += request
                        val response = "{}".toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(response)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket = null
                }
            }
        }
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
    }
}
