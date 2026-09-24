package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
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

    @Test fun memberSearchLivesUnderSearchTab() {
        compose.setContent {
            MenuScreen(
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                openProfile = {},
                openAccount = {},
                openBrowser = {},
            )
        }
        compose.onNodeWithText("Find members").assertDoesNotExist()
        compose.onNodeWithText("My profile").assertIsDisplayed()
        compose.onNodeWithText("Frequently asked questions").assertExists()
    }
}
