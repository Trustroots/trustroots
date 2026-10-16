package org.trustroots.android.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.graphics.toPixelMap
import org.junit.Assert.assertEquals
import org.trustroots.android.ui.theme.TrustrootsGreen
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MemberNavigationBarJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun showsSelectionUnreadBadgeAndProfileAndNavigates() {
        compose.setContent {
            var destination by remember { mutableStateOf(Destination.Circles) }
            NativeTestAppFrame(
                destination = destination,
                unreadMessageCount = 2,
                onNavigate = { destination = it },
            ) {}
        }

        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        val navigation = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot
        val pixels = compose.onRoot().captureToImage().toPixelMap()
        assertEquals(TrustrootsGreen, pixels[1, navigation.center.y.toInt()])
        compose.onNodeWithTag("navigation-messages").assertIsDisplayed()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "2 unread conversations"))
        compose.onNodeWithText("Profile").assertIsDisplayed()

        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithTag("navigation-search").assertIsSelected()
        compose.onNodeWithTag("navigation-circles").assertIsNotSelected()
    }
}
