package org.trustroots.android.ui

import android.Manifest
import android.content.Context
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class AccountAlertSettingsJourneyTest {
    @get:Rule val notificationPermissionRule = GrantPermissionRule.grant(*notificationPermissionsToGrant())
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private val preferences
        get() = InstrumentationRegistry.getInstrumentation().targetContext
            .getSharedPreferences("message-alerts", Context.MODE_PRIVATE)

    @Before fun isolateMessageAlertState() {
        previousPreferences = preferences.all
        previousStatus = MessageAlerts.status.value
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
    }

    @After fun cleanUp() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
        restorePreferences(preferences, previousPreferences)
        MessageAlerts.status.value = previousStatus
    }

    @Test fun showsPendingEmailConfirmationAddress() {
        respondToAccountRequest(
            """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","emailTemporary":"pending@example.test","newsletter":false}""",
        )
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = api(),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                )
            }
        }

        waitForText("Email confirmation is pending for pending@example.test.")
        compose.onNodeWithText("Email confirmation is pending for pending@example.test.")
            .performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText("member@example.test").performScrollTo().assertIsDisplayed()
        responder?.join(1_000)
    }

    @Test fun togglesMessageAlertsThroughInjectedOfflineCallbacks() {
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
        val enableCalls = AtomicInteger()
        val disableCalls = AtomicInteger()
        respondToAccountRequest(
            """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}""",
        )
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = api(),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                    enableMessageAlerts = { _, activeSession, onResult ->
                        enableCalls.incrementAndGet()
                        preferences.edit()
                            .putString("account", activeSession.member.username)
                            .putBoolean("enabled", true)
                            .apply()
                        onResult("Message alerts are ready.")
                    },
                    disableMessageAlerts = { _, _ ->
                        disableCalls.incrementAndGet()
                        preferences.edit().clear().apply()
                    },
                )
            }
        }
        waitForText("member@example.test")

        compose.onNodeWithText("Turn on message alerts").performScrollTo().performClick()
        waitForText("Message alerts are ready.")
        compose.onNodeWithText("Turn off message alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Message alerts are ready.").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Turn off message alerts").performScrollTo().performClick()
        waitForText("Message alerts are off.")
        compose.onNodeWithText("Turn on message alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Message alerts are off.").performScrollTo().assertIsDisplayed()

        org.junit.Assert.assertEquals(1, enableCalls.get())
        org.junit.Assert.assertEquals(1, disableCalls.get())
        responder?.join(1_000)
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun respondToAccountRequest(payload: String) {
        responder = thread(isDaemon = true, name = "account-alert-settings-fixture") {
            try {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    return@thread
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                activeSocket.set(socket)
                socket.use {
                    socket.soTimeout = 5_000
                    val input = socket.getInputStream()
                    val requestLine = readLine(input).orEmpty()
                    while (!readLine(input).isNullOrEmpty()) Unit
                    val bytes = payload.toByteArray(Charsets.UTF_8)
                    val output = socket.getOutputStream()
                    output.write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    output.write(bytes)
                    output.flush()
                    check(requestLine == "GET /api/users/steady-heron HTTP/1.1") {
                        "Unexpected account fixture request: $requestLine"
                    }
                }
                activeSocket.compareAndSet(socket, null)
            } catch (error: IOException) {
                if (!server.isClosed) throw error
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
    }

    private fun readLine(input: java.io.InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val next = input.read()
            if (next < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            if (next == '\n'.code) {
                val line = bytes.toByteArray()
                val length = if (line.lastOrNull() == '\r'.code.toByte()) line.size - 1 else line.size
                return String(line, 0, length, Charsets.US_ASCII)
            }
            bytes.write(next)
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

    private fun notificationPermissionsToGrant(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray()
        }
}
