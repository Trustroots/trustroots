package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class AccountPendingChangesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val accountRequestReached = CountDownLatch(1)
    private val releaseAccountResponse = CountDownLatch(1)
    private val passwordRequestReached = CountDownLatch(1)
    private val releasePasswordResponse = CountDownLatch(1)
    private val backCount = AtomicInteger()
    private var fixture: LocalTransportFixture? = null

    @After fun releasePendingResponsesAndCloseFixture() {
        releaseAccountResponse.countDown()
        releasePasswordResponse.countDown()
        fixture?.close()
    }

    @Test fun accountAndPasswordChangesKeepTheScreenUntilPendingRequestsFinish() {
        val local = LocalTransportFixture { request ->
            when (request.method to request.path) {
                "GET" to "/api/users/steady-heron" -> LocalTransportFixture.Response(accountDetails)
                "PUT" to "/api/users" -> {
                    accountRequestReached.countDown()
                    check(releaseAccountResponse.await(15, TimeUnit.SECONDS)) {
                        "Account response was not released by the test"
                    }
                    LocalTransportFixture.Response(updatedAccountDetails)
                }
                "POST" to "/api/users/password" -> {
                    passwordRequestReached.countDown()
                    check(releasePasswordResponse.await(15, TimeUnit.SECONDS)) {
                        "Password response was not released by the test"
                    }
                    LocalTransportFixture.Response("{}")
                }
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = { error("A valid local response must not invalidate the session") },
                onBack = { backCount.incrementAndGet() },
                onResetPassword = {},
                onSignedOut = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("old@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Email address").performTextReplacement("new@example.test")
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()

        assertTrue("The account update should reach the local fixture", accountRequestReached.await(15, TimeUnit.SECONDS))
        compose.onNodeWithText("Saving…").performScrollTo().assertIsDisplayed().assertIsNotEnabled()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        assertEquals("Back must not leave during the account update", 0, backCount.get())
        releaseAccountResponse.countDown()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Account saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Account saved.").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Current password").performScrollTo().performTextReplacement("fictional-current-password")
        compose.onNodeWithText("New password").performScrollTo().performTextReplacement("fictional-new-password")
        compose.onNodeWithText("Verify new password").performScrollTo().performTextReplacement("fictional-new-password")
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().performClick()

        assertTrue("The password update should reach the local fixture", passwordRequestReached.await(15, TimeUnit.SECONDS))
        compose.onNodeWithText("Changing…").performScrollTo().assertIsDisplayed().assertIsNotEnabled()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        assertEquals("Back must not leave during the password update", 0, backCount.get())
        releasePasswordResponse.countDown()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Password changed.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Password changed.").performScrollTo().assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        assertEquals("Back should work again after the pending changes finish", 1, backCount.get())

        assertEquals("The fixture should receive only the initial load and the two submitted changes", 3, local.requests.size)
        val requests = local.requests.toList()
        assertEquals(listOf("GET", "PUT", "POST"), requests.map { it.method })
        assertEquals(listOf("/api/users/steady-heron", "/api/users", "/api/users/password"), requests.map { it.path })
        assertTrue(requests.all { it.cookie == "connect.sid=fictional-session" })
        val accountPayload = JSONObject(requests[1].body)
        assertEquals("new@example.test", accountPayload.getString("email"))
        assertEquals(false, accountPayload.getBoolean("newsletter"))
        val passwordPayload = JSONObject(requests[2].body)
        assertEquals("fictional-current-password", passwordPayload.getString("currentPassword"))
        assertEquals("fictional-new-password", passwordPayload.getString("newPassword"))
    }

    private companion object {
        const val accountDetails =
            """{"username":"steady-heron","displayName":"Steady Heron","email":"old@example.test","newsletter":false}"""
        const val updatedAccountDetails =
            """{"username":"steady-heron","displayName":"Steady Heron","email":"new@example.test","newsletter":false}"""
    }
}
