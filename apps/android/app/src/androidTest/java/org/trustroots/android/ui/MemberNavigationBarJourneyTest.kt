package org.trustroots.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MemberNavigationBarJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun showsSelectionUnreadBadgeAndProfileAndNavigates() {
        compose.setContent {
            TrustrootsTheme {
                var destination by remember { mutableStateOf(Destination.Circles) }
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        MemberNavigationBar(
                            destination = destination,
                            unreadMessageCount = 2,
                            avatarURL = null,
                            sessionCookie = null,
                            memberLabel = "Quiet Fox",
                            onNavigate = { destination = it },
                        )
                    },
                ) { insets ->
                    Box(
                        Modifier.fillMaxSize().padding(insets),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Community navigation")
                    }
                }
            }
        }

        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        captureUsabilityScreenshot(compose, "android_navigation")
        compose.onNodeWithTag("navigation-messages").assertIsDisplayed()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "2 unread conversations"))
        compose.onNodeWithText("Profile").assertIsDisplayed()

        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithTag("navigation-search").assertIsSelected()
        compose.onNodeWithTag("navigation-circles").assertIsNotSelected()
    }
}
