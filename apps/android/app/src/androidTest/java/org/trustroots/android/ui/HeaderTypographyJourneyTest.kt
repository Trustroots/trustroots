@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarState
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.profile.ProfileActionBar
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HeaderTypographyJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun profileTitlesMatchTheSharedAppBarInExpandedAndCollapsedStates() {
        lateinit var barState: TopAppBarState
        compose.setContent {
            TrustrootsTheme {
                barState = rememberTopAppBarState()
                Column {
                    PinnedTopAppBar(
                        title = "Shared title",
                        scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(barState),
                        contentPadding = PaddingValues.Zero,
                    )
                    ArtworkHero(
                        url = null,
                        sessionCookie = null,
                        label = "Expanded profile",
                        subtitle = "A fictional profile",
                        background = MaterialTheme.colorScheme.primary,
                        blurBackground = false,
                        testTag = "typographyArtwork",
                    )
                    Surface(color = Color.Black) {
                        ProfileActionBar(
                            isSelf = true,
                            onBack = {},
                            onEditProfile = {},
                            onMessage = {},
                            onShareExperience = {},
                            contactLabel = null,
                            onContactAction = {},
                            topPadding = 0.dp,
                            horizontalInset = PaddingValues.Zero,
                            compactTitle = "Compact profile",
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
        assertSameTypography(textStyle("Shared title"), textStyle("Expanded profile"))

        compose.runOnIdle {
            assertTrue(barState.heightOffsetLimit < 0f)
            barState.heightOffset = barState.heightOffsetLimit
        }
        compose.waitForIdle()
        assertSameTypography(textStyle("Shared title"), textStyle("Compact profile"))
    }

    private fun textStyle(label: String): TextStyle {
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(label).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { action ->
            assertTrue(action(results))
        }
        return results.single().layoutInput.style
    }

    private fun assertSameTypography(expected: TextStyle, actual: TextStyle) {
        assertEquals(expected.fontSize, actual.fontSize)
        assertEquals(expected.fontWeight, actual.fontWeight)
        assertEquals(expected.letterSpacing, actual.letterSpacing)
    }
}
