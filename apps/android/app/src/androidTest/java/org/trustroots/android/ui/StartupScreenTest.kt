package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.startup.StartupScreen

@RunWith(AndroidJUnit4::class)
class StartupScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun greetsReturningMemberAndShowsBuildDate() {
        compose.setContent { StartupScreen("River") }
        compose.onNodeWithContentDescription("Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Hi River").assertIsDisplayed()
        compose.onNodeWithText("Build:", substring = true).assertIsDisplayed()
    }

    @Test fun omitsGreetingWhenMemberNameIsBlank() {
        compose.setContent { StartupScreen("   ") }

        compose.onNodeWithContentDescription("Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Hi", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Build:", substring = true).assertIsDisplayed()
    }
}
