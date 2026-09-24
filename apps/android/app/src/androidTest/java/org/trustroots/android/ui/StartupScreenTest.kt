package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartupScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun greetsReturningMemberAndShowsBuildDate() {
        compose.setContent { StartupScreen("River") }
        compose.onNodeWithContentDescription("Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Hi River").assertIsDisplayed()
        compose.onNodeWithText("Build:", substring = true).assertIsDisplayed()
    }
}
