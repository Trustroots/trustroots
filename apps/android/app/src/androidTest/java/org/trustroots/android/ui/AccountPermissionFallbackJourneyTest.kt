package org.trustroots.android.ui

import org.trustroots.android.ui.account.AccountSettingsScreen

import android.Manifest
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.core.app.ActivityOptionsCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class AccountPermissionFallbackJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val alertPreferences
        get() = context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE)
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null
    private var previousAlertPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousAlertStatus: String? = null
    private var previousAlertStatusMetadata: MessageAlertStatusMetadata? = null

    @Before fun isolateAlertState() {
        previousAlertPreferences = alertPreferences.all
        previousAlertStatus = MessageAlerts.status.value
        previousAlertStatusMetadata = MessageAlerts.statusMetadata.value
        alertPreferences.edit().clear().commit()
        MessageAlerts.status.value = null
        MessageAlerts.statusMetadata.value = null
    }

    @After fun restoreAlertStateAndStopApi() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.status.value = previousAlertStatus
        MessageAlerts.statusMetadata.value = previousAlertStatusMetadata
    }

    @Test fun reportsPermissionDenialWithoutCallingEnableCallback() {
        assumeTrue("The notification permission gate starts on Android 13", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        startAccountFixture()
        val enableCalls = AtomicInteger()
        val deniedContext = object : ContextWrapper(compose.activity) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_DENIED
                else super.checkSelfPermission(permission)
        }
        val registryOwner = TestActivityResultRegistryOwner(PermissionDeniedRegistry())

        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides deniedContext,
                LocalActivityResultRegistryOwner provides registryOwner,
            ) {
                TrustrootsTheme {
                    AccountSettingsScreen(
                        api = api(),
                        session = session,
                        onSessionInvalidated = {},
                        onBack = {},
                        onResetPassword = {},
                        onSignedOut = {},
                        enableMessageAlerts = { _, _, _ -> enableCalls.incrementAndGet() },
                    )
                }
            }
        }
        waitForText("member@example.test")

        compose.onNodeWithText("Turn on message alerts").performScrollTo().performClick()
        waitForText("Allow notifications in Android settings to receive message alerts.")
        compose.onNodeWithText("Allow notifications in Android settings to receive message alerts.")
            .performScrollTo()
            .assertIsDisplayed()
        org.junit.Assert.assertEquals(0, enableCalls.get())
        org.junit.Assert.assertFalse(MessageAlerts.isEnabled(context, session.member.username))
        compose.waitForIdle()
    }

    @Test fun reportsMissingActivityEvenWhenPermissionIsGranted() {
        startAccountFixture()
        val enableCalls = AtomicInteger()
        val nonActivityContext = object : ContextWrapper(context.applicationContext) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_GRANTED
                else super.checkSelfPermission(permission)
        }
        val registryOwner: ActivityResultRegistryOwner = compose.activity

        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides nonActivityContext,
                LocalActivityResultRegistryOwner provides registryOwner,
            ) {
                TrustrootsTheme {
                    AccountSettingsScreen(
                        api = api(),
                        session = session,
                        onSessionInvalidated = {},
                        onBack = {},
                        onResetPassword = {},
                        onSignedOut = {},
                        enableMessageAlerts = { _, _, _ -> enableCalls.incrementAndGet() },
                    )
                }
            }
        }
        waitForText("member@example.test")

        compose.onNodeWithText("Turn on message alerts").performScrollTo().performClick()
        waitForText("Could not choose a push distributor.")
        compose.onNodeWithText("Could not choose a push distributor.")
            .performScrollTo()
            .assertIsDisplayed()
        org.junit.Assert.assertEquals(0, enableCalls.get())
        org.junit.Assert.assertFalse(MessageAlerts.isEnabled(context, session.member.username))
        compose.waitForIdle()
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startAccountFixture() {
        responder = thread(isDaemon = true, name = "account-permission-fixture") {
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
                    check(requestLine == "GET /api/users/steady-heron HTTP/1.1") {
                        "Unexpected account fixture request: $requestLine"
                    }
                    val body = """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}"""
                        .toByteArray(Charsets.UTF_8)
                    val output = socket.getOutputStream()
                    output.write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    output.write(body)
                    output.flush()
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

    private class TestActivityResultRegistryOwner(
        override val activityResultRegistry: ActivityResultRegistry,
    ) : ActivityResultRegistryOwner

    private class PermissionDeniedRegistry : ActivityResultRegistry() {
        @Suppress("UNCHECKED_CAST")
        override fun <I, O> onLaunch(
            requestCode: Int,
            contract: ActivityResultContract<I, O>,
            input: I,
            options: ActivityOptionsCompat?,
        ) {
            dispatchResult(requestCode, false as O)
        }
    }
}
