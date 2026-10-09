package org.trustroots.android.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ApkUpdateSettingsJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun memberEnablesChecksAndOpensAvailableRelease() {
        var enabled by mutableStateOf(false)
        var status by mutableStateOf<String?>(null)
        var releaseUrl by mutableStateOf<String?>(null)
        var openedUrl: String? = null
        compose.setContent {
            ApkUpdateSettings(
                enabled = enabled,
                checking = false,
                status = status,
                releaseUrl = releaseUrl,
                onToggle = { enabled = !enabled },
                onCheck = {
                    status = "Android preview 0.1-2 is available."
                    releaseUrl = "https://github.com/Trustroots/trustroots/releases/tag/android-preview-2"
                },
                onOpenRelease = { openedUrl = it },
            )
        }

        compose.onNodeWithText("Turn on update alerts").performClick()
        compose.onNodeWithText("Check for updates now").performClick()
        compose.onNodeWithText("Android preview 0.1-2 is available.").assertIsDisplayed()
        compose.onNodeWithText("Open release page").performClick()
        assertEquals("https://github.com/Trustroots/trustroots/releases/tag/android-preview-2", openedUrl)
        compose.onNodeWithText("Turn off update alerts").performClick()
        compose.onNodeWithText("Turn on update alerts").assertIsDisplayed()
    }
}
