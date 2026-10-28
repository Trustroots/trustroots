package org.trustroots.android.ui

import org.trustroots.android.ui.account.AccountSettingsScreen

import android.Manifest
import android.app.Activity
import android.app.Instrumentation
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.ActivityOptionsCompat
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.updates.AndroidPreviewRelease
import org.trustroots.android.updates.ApkUpdateCheckResult
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class AccountPreviewUpdateAlertsJourneyTest {
    @get:Rule val notificationPermissionRule = GrantPermissionRule.grant(*notificationPermissionsToGrant())
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val messagePreferences
        get() = context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE)
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null
    private var pendingUpdateCheck: CompletableDeferred<ApkUpdateCheckResult>? = null
    private var previousMessagePreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousMessageStatus: String? = null
    private var previousMessageStatusMetadata: MessageAlertStatusMetadata? = null

    @Before fun isolateAccountState() {
        previousMessagePreferences = messagePreferences.all
        previousMessageStatus = MessageAlerts.status.value
        previousMessageStatusMetadata = MessageAlerts.statusMetadata.value
        messagePreferences.edit().clear().commit()
        MessageAlerts.status.value = null
        MessageAlerts.statusMetadata.value = null
    }

    @After fun restoreAccountState() {
        try {
            pendingUpdateCheck?.complete(ApkUpdateCheckResult.Unavailable)
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder?.join(2_000)
            assertTrue("The local account fixture should stop after shutdown", responder?.isAlive != true)
            responderFailure.get()?.let { throw AssertionError("The local account fixture failed", it) }
        } finally {
            restorePreferences(messagePreferences, previousMessagePreferences)
            MessageAlerts.status.value = previousMessageStatus
            MessageAlerts.statusMetadata.value = previousMessageStatusMetadata
        }
    }

    @Test fun memberCanEnableCheckRetryOpenAndDisablePreviewUpdatesOffline() {
        startAccountFixture()
        val firstCheck = CompletableDeferred<ApkUpdateCheckResult>()
        pendingUpdateCheck = firstCheck
        val firstCheckStarted = CountDownLatch(1)
        val checkCount = AtomicInteger()
        val enabledValues = CopyOnWriteArrayList<Boolean>()
        val openedRelease = AtomicReference<String?>()
        val release = AndroidPreviewRelease(
            versionCode = 88,
            versionName = "Offline preview 88",
            pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/android-preview-88",
        )
        val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))

        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                    previewUpdateAlerts = true,
                    isUpdateAlertsEnabled = { false },
                    setUpdateAlertsEnabled = { _, enabled -> enabledValues += enabled },
                    checkPreviewUpdates = {
                        when (checkCount.incrementAndGet()) {
                            1 -> {
                                firstCheckStarted.countDown()
                                firstCheck.await()
                            }
                            2 -> ApkUpdateCheckResult.NewVersion(release)
                            else -> ApkUpdateCheckResult.UpToDate
                        }
                    },
                    openPreviewRelease = { _, url -> openedRelease.set(url) },
                )
            }
        }

        waitForText("member@example.test")
        compose.onNodeWithText("APK updates").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Turn on update alerts").performScrollTo().performClick()
        assert(firstCheckStarted.await(5, TimeUnit.SECONDS)) { "Enabling updates did not start an immediate check" }
        compose.onNodeWithText("Checking for updates…").performScrollTo().assertIsDisplayed().assertIsNotEnabled()

        firstCheck.complete(ApkUpdateCheckResult.Unavailable)
        pendingUpdateCheck = null
        waitForText("Could not check for updates. Try again later.")
        waitForText("Check for updates now")
        compose.onNodeWithText("Check for updates now").performScrollTo().assertIsEnabled().performClick()
        waitForText("Offline preview 88 is available.")
        waitForText("Check for updates now")
        compose.onNodeWithText("Open release page").performScrollTo().performClick()
        compose.waitUntil(5_000) { openedRelease.get() != null }
        assertEquals(release.pageUrl, openedRelease.get())

        compose.onNodeWithText("Check for updates now").performScrollTo().performClick()
        waitForText("You have the latest Android preview.")
        waitForText("Check for updates now")
        compose.onNodeWithText("Open release page").assertDoesNotExist()

        compose.onNodeWithText("Turn off update alerts").performScrollTo().performClick()
        waitForText("Update alerts are off.")
        compose.onNodeWithText("Turn on update alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Open release page").assertDoesNotExist()
        assertEquals(listOf(true, false), enabledValues.toList())
        assertEquals(3, checkCount.get())
        responder?.join(2_000)
        assertTrue("The local account fixture should finish its response", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The local account fixture failed", it) }
    }

    @Test fun enabledPreviewAlertsShowNoUpdateStatusUntilTheMemberChecks() {
        startAccountFixture()
        val checks = AtomicInteger()
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                    previewUpdateAlerts = true,
                    isUpdateAlertsEnabled = { true },
                    checkPreviewUpdates = {
                        checks.incrementAndGet()
                        ApkUpdateCheckResult.UpToDate
                    },
                )
            }
        }

        waitForText("member@example.test")
        compose.onNodeWithText("APK updates").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Check for updates now").performScrollTo().assertIsEnabled()
        compose.onNodeWithText("You have the latest Android preview.").assertDoesNotExist()
        compose.onNodeWithText("Could not check for updates. Try again later.").assertDoesNotExist()
        compose.onNodeWithText("Open release page").assertDoesNotExist()
        assertEquals("Opening settings should not check for updates automatically", 0, checks.get())
    }

    @Test fun lateReleaseResultCannotTurnAlertsBackOnAfterTheyAreDisabled() {
        startAccountFixture()
        val lateCheck = CompletableDeferred<ApkUpdateCheckResult>()
        pendingUpdateCheck = lateCheck
        val firstCheckStarted = CountDownLatch(1)
        val checks = AtomicInteger()
        val enabledValues = CopyOnWriteArrayList<Boolean>()
        val release = AndroidPreviewRelease(
            versionCode = 89,
            versionName = "Late offline preview",
            pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/android-preview-89",
        )
        val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))

        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                    previewUpdateAlerts = true,
                    isUpdateAlertsEnabled = { false },
                    setUpdateAlertsEnabled = { _, enabled -> enabledValues += enabled },
                    checkPreviewUpdates = {
                        if (checks.incrementAndGet() == 1) {
                            firstCheckStarted.countDown()
                            lateCheck.await()
                        } else {
                            ApkUpdateCheckResult.UpToDate
                        }
                    },
                )
            }
        }

        waitForText("member@example.test")
        compose.onNodeWithText("Turn on update alerts").performScrollTo().performClick()
        assertTrue("Enabling updates did not start a check", firstCheckStarted.await(5, TimeUnit.SECONDS))
        compose.onNodeWithText("Turn off update alerts").performScrollTo().performClick()
        waitForText("Update alerts are off.")

        lateCheck.complete(ApkUpdateCheckResult.NewVersion(release))
        pendingUpdateCheck = null
        compose.waitForIdle()
        compose.onNodeWithText("Update alerts are off.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Turn on update alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Late offline preview is available.").assertDoesNotExist()
        compose.onNodeWithText("Open release page").assertDoesNotExist()

        compose.onNodeWithText("Turn on update alerts").performScrollTo().performClick()
        waitForText("You have the latest Android preview.")
        compose.onNodeWithText("Check for updates now").performScrollTo().assertIsEnabled()
        assertEquals(listOf(true, false, true), enabledValues.toList())
        assertEquals(2, checks.get())
    }

    @Test fun deniedUpdatePermissionDoesNotEnableAlertsOrStartAReleaseCheck() {
        assumeTrue("The notification permission gate starts on Android 13", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        startAccountFixture()
        val deniedContext = deniedNotificationContext()
        val enableCalls = AtomicInteger()
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides deniedContext,
                LocalActivityResultRegistryOwner provides TestActivityResultRegistryOwner(PermissionResultRegistry(granted = false)),
            ) {
                TrustrootsTheme {
                    AccountSettingsScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                        onBack = {},
                        onResetPassword = {},
                        onSignedOut = {},
                        previewUpdateAlerts = true,
                        isUpdateAlertsEnabled = { false },
                        setUpdateAlertsEnabled = { _, _ -> enableCalls.incrementAndGet() },
                        checkPreviewUpdates = {
                            enableCalls.incrementAndGet()
                            ApkUpdateCheckResult.UpToDate
                        },
                    )
                }
            }
        }

        waitForText("member@example.test")
        compose.onNodeWithText("Turn on update alerts").performScrollTo().performClick()
        waitForText("Allow Trustroots notifications in Android settings to receive update alerts.")
        compose.onNodeWithText("Turn on update alerts").performScrollTo().assertIsDisplayed()
        assertEquals(0, enableCalls.get())
    }

    @Test fun grantedUpdatePermissionEnablesAlertsAndStartsAReleaseCheck() {
        assumeTrue("The notification permission gate starts on Android 13", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        startAccountFixture()
        val enabledValues = CopyOnWriteArrayList<Boolean>()
        val checks = AtomicInteger()
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides deniedNotificationContext(),
                LocalActivityResultRegistryOwner provides TestActivityResultRegistryOwner(PermissionResultRegistry(granted = true)),
            ) {
                TrustrootsTheme {
                    AccountSettingsScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                        onBack = {},
                        onResetPassword = {},
                        onSignedOut = {},
                        previewUpdateAlerts = true,
                        isUpdateAlertsEnabled = { false },
                        setUpdateAlertsEnabled = { _, enabled -> enabledValues += enabled },
                        checkPreviewUpdates = {
                            checks.incrementAndGet()
                            ApkUpdateCheckResult.UpToDate
                        },
                    )
                }
            }
        }

        waitForText("member@example.test")
        compose.onNodeWithText("Turn on update alerts").performScrollTo().performClick()
        waitForText("You have the latest Android preview.")
        compose.onNodeWithText("Turn off update alerts").performScrollTo().assertIsDisplayed()
        assertEquals(listOf(true), enabledValues.toList())
        assertEquals(1, checks.get())
    }

    @Test fun defaultReleaseActionLaunchesTheExpectedUrlWithoutOpeningABrowser() {
        startAccountFixture()
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val monitor = object : Instrumentation.ActivityMonitor() {
            @Volatile var interceptedIntent: Intent? = null

            override fun onStartActivity(intent: Intent): Instrumentation.ActivityResult? {
                if (intent.action != Intent.ACTION_VIEW) return null
                interceptedIntent = Intent(intent)
                return Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null)
            }
        }
        val release = AndroidPreviewRelease(
            versionCode = 97,
            versionName = "Offline preview 97",
            pageUrl = "https://github.com/Trustroots/trustroots/releases/tag/android-preview-97",
        )
        instrumentation.addMonitor(monitor)

        try {
            compose.setContent {
                TrustrootsTheme {
                    AccountSettingsScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                        onBack = {},
                        onResetPassword = {},
                        onSignedOut = {},
                        previewUpdateAlerts = true,
                        isUpdateAlertsEnabled = { false },
                        setUpdateAlertsEnabled = { _, _ -> },
                        checkPreviewUpdates = { ApkUpdateCheckResult.NewVersion(release) },
                        // Keep the default openPreviewRelease callback under test.
                    )
                }
            }

            waitForText("member@example.test")
            compose.onNodeWithText("Turn on update alerts").performScrollTo().performClick()
            waitForText("Offline preview 97 is available.")
            compose.onNodeWithText("Open release page").performScrollTo().performClick()
            compose.waitUntil(5_000) { monitor.interceptedIntent != null }

            val intent = monitor.interceptedIntent
            assertEquals(Intent.ACTION_VIEW, intent?.action)
            assertEquals(release.pageUrl, intent?.dataString)
            responder?.join(2_000)
            assertTrue("The local account fixture should finish its response", responder?.isAlive != true)
            responderFailure.get()?.let { throw AssertionError("The local account fixture failed", it) }
        } finally {
            instrumentation.removeMonitor(monitor)
        }
    }

    private fun deniedNotificationContext(): Context = object : ContextWrapper(compose.activity) {
        override fun checkSelfPermission(permission: String): Int =
            if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_DENIED
            else super.checkSelfPermission(permission)
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startAccountFixture() {
        responder = thread(isDaemon = true, name = "preview-update-account-fixture") {
            try {
                val socket = try {
                    server.accept()
                } catch (error: SocketTimeoutException) {
                    throw AssertionError("Timed out waiting for account details request", error)
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                activeSocket.set(socket)
                socket.use {
                    socket.soTimeout = 10_000
                    val input = socket.getInputStream().bufferedReader()
                    val requestLine = input.readLine() ?: throw EOFException("Missing account details request")
                    while (true) {
                        val header = input.readLine() ?: throw EOFException("Incomplete account request headers")
                        if (header.isEmpty()) break
                    }
                    check(requestLine == "GET /api/users/steady-heron HTTP/1.1") {
                        "Unexpected account fixture request: $requestLine"
                    }
                    val body =
                        """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}"""
                            .toByteArray(Charsets.UTF_8)
                    socket.getOutputStream().apply {
                        write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(body)
                        flush()
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) responderFailure.set(error)
            } catch (error: Throwable) {
                responderFailure.set(error)
            } finally {
                activeSocket.getAndSet(null)?.close()
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

    private fun notificationPermissionsToGrant(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray()
        }

    private class TestActivityResultRegistryOwner(
        override val activityResultRegistry: ActivityResultRegistry,
    ) : ActivityResultRegistryOwner

    private class PermissionResultRegistry(private val granted: Boolean) : ActivityResultRegistry() {
        @Suppress("UNCHECKED_CAST")
        override fun <I, O> onLaunch(
            requestCode: Int,
            contract: ActivityResultContract<I, O>,
            input: I,
            options: ActivityOptionsCompat?,
        ) {
            dispatchResult(requestCode, granted as O)
        }
    }
}
