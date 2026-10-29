package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.account.AccountSettingsScreen

@RunWith(AndroidJUnit4::class)
class AccountSavePasswordPendingJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val saveStarted = CountDownLatch(1)
    private val releaseSave = CountDownLatch(1)
    private val passwordChangeStarted = CountDownLatch(1)
    private val releasePasswordChange = CountDownLatch(1)
    private val invalidations = AtomicInteger()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        releaseSave.countDown()
        releasePasswordChange.countDown()
        fixture?.close()
    }

    @Test fun accountAndPasswordButtonsShowPendingStateAndRejectDuplicateSubmissions() {
        val fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(profileJson)
                request.method == "PUT" && request.path == "/api/users" -> {
                    saveStarted.countDown()
                    check(releaseSave.await(10, TimeUnit.SECONDS)) { "Account save was not released by the test" }
                    LocalTransportFixture.Response(updatedProfileJson)
                }
                request.method == "POST" && request.path == "/api/users/password" -> {
                    passwordChangeStarted.countDown()
                    check(releasePasswordChange.await(10, TimeUnit.SECONDS)) { "Password change was not released by the test" }
                    LocalTransportFixture.Response("{}")
                }
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient(fixture.baseURL),
                session = MemberSession("connect.sid=fictional-pending-session", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = { invalidations.incrementAndGet() },
                onBack = {},
                onResetPassword = {},
                onSignedOut = {},
                previewUpdateAlerts = false,
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("original@example.test").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Email address").performTextReplacement("updated@example.test")
        hideTestKeyboard()
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()
        assertTrue("Account update request should reach the held response", saveStarted.await(5, TimeUnit.SECONDS))
        waitForText("Saving…")
        val savingButton = actionButton("Saving…").performScrollTo()
        savingButton.assertIsDisplayed().assertIsNotEnabled()
        savingButton.performTouchInput { click() }
        compose.waitForIdle()
        assertEquals(1, fixture.requests.count { it.method == "PUT" && it.path == "/api/users" })

        releaseSave.countDown()
        waitForText("Account saved.")
        actionButton("Save email settings").performScrollTo().assertIsDisplayed().assertIsEnabled()

        compose.onNodeWithText("Current password").performScrollTo().performTextReplacement("fictional-current-secret")
        compose.onNodeWithText("New password").performScrollTo().performTextReplacement("fictional-new-secret")
        compose.onNodeWithText("Verify new password").performScrollTo().performTextReplacement("fictional-new-secret")
        hideTestKeyboard()
        actionButton("Change password").performScrollTo().performClick()
        assertTrue("Password update request should reach the held response", passwordChangeStarted.await(5, TimeUnit.SECONDS))
        waitForText("Changing…")
        val changingButton = actionButton("Changing…").performScrollTo()
        changingButton.assertIsDisplayed().assertIsNotEnabled()
        changingButton.performTouchInput { click() }
        compose.waitForIdle()
        assertEquals(1, fixture.requests.count { it.method == "POST" && it.path == "/api/users/password" })

        releasePasswordChange.countDown()
        waitForText("Password changed.")
        actionButton("Change password").performScrollTo().assertIsDisplayed().assertIsNotEnabled()
        assertEquals(0, invalidations.get())
    }

    private fun actionButton(label: String) = compose.onNode(hasText(label) and hasClickAction())

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private companion object {
        const val profileJson = """{"username":"steady-heron","displayName":"Steady Heron","email":"original@example.test","newsletter":false}"""
        const val updatedProfileJson = """{"username":"steady-heron","displayName":"Steady Heron","email":"updated@example.test","newsletter":false}"""
    }
}
