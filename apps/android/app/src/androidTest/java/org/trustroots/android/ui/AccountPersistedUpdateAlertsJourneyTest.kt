package org.trustroots.android.ui

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.awaitCancellation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.updates.ApkUpdateCheckResult
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class AccountPersistedUpdateAlertsJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val fixture = LocalTransportFixture { request ->
        check(request.method == "GET" && request.path == "/api/users/steady-heron") {
            "Unexpected account fixture request: ${request.method} ${request.path}"
        }
        LocalTransportFixture.Response(
            """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}""",
        )
    }

    @org.junit.After
    fun closeFixture() {
        fixture.close()
    }

    @Test
    fun persistedEnabledAlertsCanBeTurnedOffWhileCheckIsPending() {
        val persistedEnabled = AtomicBoolean(true)
        val writes = CopyOnWriteArrayList<Boolean>()
        val checkStarted = CountDownLatch(1)
        val checkCancelled = CountDownLatch(1)
        val checkCalls = AtomicInteger()

        renderAccountSettings(
            persistedEnabled = persistedEnabled,
            setPersistedEnabled = { enabled ->
                writes += enabled
                persistedEnabled.set(enabled)
            },
            checkPreviewUpdates = {
                checkCalls.incrementAndGet()
                checkStarted.countDown()
                try {
                    awaitCancellation()
                } finally {
                    checkCancelled.countDown()
                }
            },
        )

        waitForText("member@example.test")
        compose.onNodeWithText("Turn off update alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Check for updates now").performScrollTo().assertIsEnabled()
        assertTrue("The persisted setting should start enabled", persistedEnabled.get())
        assertEquals("/api/users/steady-heron", fixture.requests.singleOrNull()?.path)

        compose.onNodeWithText("Check for updates now").performScrollTo().performClick()
        assertTrue("The manual check did not start", checkStarted.await(5, TimeUnit.SECONDS))
        waitForText("Checking for updates…")
        compose.onNodeWithText("Turn off update alerts").performScrollTo().performClick()
        waitForText("Update alerts are off.")

        assertTrue("Turning alerts off should cancel the pending check", checkCancelled.await(5, TimeUnit.SECONDS))
        assertFalse(persistedEnabled.get())
        assertEquals(listOf(false), writes.toList())
        assertEquals(1, checkCalls.get())
        compose.onNodeWithText("Turn on update alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Check for updates now").assertDoesNotExist()
        compose.onNodeWithText("Open release page").assertDoesNotExist()
        assertEquals(listOf("/api/users/steady-heron"), fixture.requests.map { it.path })
    }

    @Test
    fun persistedEnabledAlertsAreRestoredWhenSettingsAreReopened() {
        val persistedEnabled = AtomicBoolean(true)
        val checkCalls = AtomicInteger()
        val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))

        compose.setContent {
            var showAccountSettings by remember { mutableStateOf(true) }
            TrustrootsTheme {
                if (showAccountSettings) {
                    AccountSettingsScreen(
                        api = MobileApiClient(fixture.baseURL),
                        session = session,
                        onSessionInvalidated = {},
                        onBack = { showAccountSettings = false },
                        onResetPassword = {},
                        onSignedOut = {},
                        previewUpdateAlerts = true,
                        isUpdateAlertsEnabled = { persistedEnabled.get() },
                        setUpdateAlertsEnabled = { _, enabled -> persistedEnabled.set(enabled) },
                        checkPreviewUpdates = {
                            checkCalls.incrementAndGet()
                            ApkUpdateCheckResult.UpToDate
                        },
                    )
                } else {
                    Button(onClick = { showAccountSettings = true }) { Text("Reopen account settings") }
                }
            }
        }

        waitForText("member@example.test")
        assertEnabledAlertControls()
        assertEquals(0, checkCalls.get())

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Reopen account settings").assertIsDisplayed()
        compose.onNodeWithText("Reopen account settings").performClick()

        waitForText("member@example.test")
        assertEnabledAlertControls()
        assertTrue(persistedEnabled.get())
        assertEquals(0, checkCalls.get())
        assertEquals(2, fixture.requests.count { it.path == "/api/users/steady-heron" })
    }

    private fun renderAccountSettings(
        persistedEnabled: AtomicBoolean,
        setPersistedEnabled: (Boolean) -> Unit,
        checkPreviewUpdates: suspend () -> ApkUpdateCheckResult,
    ) {
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = MobileApiClient(fixture.baseURL),
                    session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                    previewUpdateAlerts = true,
                    isUpdateAlertsEnabled = { persistedEnabled.get() },
                    setUpdateAlertsEnabled = { _, enabled -> setPersistedEnabled(enabled) },
                    checkPreviewUpdates = { checkPreviewUpdates() },
                )
            }
        }
    }

    private fun assertEnabledAlertControls() {
        compose.onNodeWithText("Turn off update alerts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Check for updates now").performScrollTo().assertIsEnabled()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }
}
