package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

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
        compose.onNodeWithText("Find people").assertIsDisplayed()
        compose.onNodeWithText("Host").assertIsDisplayed()
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithText("Nostroots").assertIsDisplayed()
        compose.onNodeWithText("Circles").assertIsDisplayed()
        compose.onNodeWithText("Edit profile").assertIsDisplayed()
        compose.onNodeWithText("Account").assertIsDisplayed()
        compose.onNodeWithText("Safety").assertIsDisplayed()
        compose.onNodeWithText("Contact and support").assertIsDisplayed()
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        compose.onNodeWithText("Sign out").assertDoesNotExist()
    }
}
