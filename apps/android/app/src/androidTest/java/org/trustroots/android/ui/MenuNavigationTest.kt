package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.menu.MenuScreen

@RunWith(AndroidJUnit4::class)
class MenuNavigationTest {
    @get:Rule val compose = createComposeRule()

    @Test fun menuMatchesPhoneWebNavigationWithoutSignOut() {
        compose.setContent {
            MenuScreen(
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                openProfile = {},
                openEditProfile = {},
                openHost = {},
                openNostroots = {},
                openContacts = {},
                openFindPeople = {},
                openCircles = {},
                openAccount = {},
                openBrowser = {},
            )
        }
        compose.onNodeWithText("Find people").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Host").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Contacts").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Nostroots").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Circles").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Edit profile").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Account").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Safety").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Contact and support").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("View your profile").performScrollTo().assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Sign out").fetchSemanticsNodes().isEmpty())
    }
}
