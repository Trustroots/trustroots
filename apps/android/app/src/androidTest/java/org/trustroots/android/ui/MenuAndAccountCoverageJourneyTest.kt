package org.trustroots.android.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.browser.BrowserRoute

@RunWith(AndroidJUnit4::class)
class MenuAndAccountCoverageJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox"))

    @Test fun menuActionsOpenTheirDestinationsAndSupportLinks() {
        val destinations = mutableListOf<String>()
        val browserRoutes = mutableListOf<BrowserRoute>()
        compose.setContent {
            MenuScreen(
                session = session,
                openProfile = { destinations.add("profile") },
                openEditProfile = { destinations.add("edit profile") },
                openHost = { destinations.add("host") },
                openNostroots = { destinations.add("Nostroots") },
                openContacts = { destinations.add("contacts") },
                openFindPeople = { destinations.add("find people") },
                openCircles = { destinations.add("circles") },
                openAccount = { destinations.add("account") },
                openBrowser = { browserRoutes.add(it) },
            )
        }

        compose.onNodeWithText("View your profile").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        compose.onNodeWithText("Host").performScrollTo().performClick()
        compose.onNodeWithText("Nostroots").performScrollTo().performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        compose.onNodeWithText("Find people").performScrollTo().performClick()
        compose.onNodeWithText("Circles").performScrollTo().performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        compose.onNodeWithText("FAQ").performScrollTo().performClick()

        assertEquals(
            listOf("profile", "edit profile", "host", "Nostroots", "contacts", "find people", "circles", "account"),
            destinations,
        )
        assertEquals(
            listOf(BrowserRoute("FAQ", "https://www.trustroots.org/faq")),
            browserRoutes,
        )
    }

    @Test fun accountExplainsTheCurrentCheckAndDisablesActionsWhileRunning() {
        var running by mutableStateOf(false)
        var checkCount = 0
        var backCount = 0
        var resetCount = 0
        var signOutCount = 0
        compose.setContent {
            AccountScreen(
                session = session,
                accountMessage = "Your account is up to date.",
                isActionRunning = running,
                actionLabel = if (running) "Checking account…" else null,
                onBack = { backCount++ },
                onCheckAccount = {
                    checkCount++
                    running = true
                },
                onResetPassword = { resetCount++ },
                onSignedOut = { signOutCount++ },
            )
        }

        compose.onNodeWithText("Signed in as Quiet Fox (@quiet-fox).", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Your account is up to date.").assertIsDisplayed()
        compose.onNodeWithText("Check account").performClick()
        compose.onNodeWithText("Checking account…").assertIsDisplayed()
        compose.onNodeWithText("Check account").assertIsNotEnabled()
        compose.onNodeWithText("Sign out").assertIsNotEnabled()

        compose.runOnIdle { running = false }
        compose.onNodeWithText("Check account").assertIsEnabled()
        compose.onNodeWithText("Checking account…").assertDoesNotExist()

        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Forgot your password?").performClick()
        compose.onNodeWithText("Sign out").performScrollTo().performClick()
        assertEquals(1, checkCount)
        assertEquals(1, backCount)
        assertEquals(1, resetCount)
        assertEquals(1, signOutCount)
    }
}
