package org.trustroots.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.common.LiveFilterField
import org.trustroots.android.ui.common.SubmittedSearchField
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class SearchFieldLayoutJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun liveFilterFitsCompactWidthAndClearsOnlyAfterInput() {
        compose.setContent {
            TrustrootsTheme {
                var query by remember { mutableStateOf("") }
                Box(Modifier.width(320.dp).background(Color(0xFF00FF00))) {
                    LiveFilterField(
                        value = query,
                        onValueChange = { query = it },
                        label = "Filter circles",
                        clearLabel = "Clear circle filter",
                        modifier = Modifier.testTag("liveFilterField"),
                    )
                }
            }
        }

        compose.onNodeWithTag("liveFilterField").assertIsDisplayed()
        compose.onNodeWithContentDescription("Clear circle filter").assertDoesNotExist()
        compose.onNodeWithTag("liveFilterField").performTextInput(" ")
        compose.onNodeWithContentDescription("Clear circle filter").assertIsDisplayed()
        compose.onNodeWithTag("liveFilterField").performTextReplacement("harbour")
        compose.onNodeWithContentDescription("Clear circle filter")
            .assertIsDisplayed()
            .assertWidthIsAtLeast(48.dp)
            .assertHeightIsAtLeast(48.dp)
        assertRoundedCornerShowsContrastingBackground("liveFilterField")
        assertWithinCompactField("liveFilterField", "Clear circle filter")
        hideTestKeyboard()
        captureUsabilityScreenshot(compose, "android_live_search_control")

        compose.onNodeWithContentDescription("Clear circle filter").performClick()
        compose.onNodeWithTag("liveFilterField").assertIsDisplayed()
        compose.onNodeWithContentDescription("Clear circle filter").assertDoesNotExist()
    }

    @Test fun submittedSearchSupportsLeadingModeAndEnabledImeSubmission() {
        var submissions = 0
        compose.setContent {
            TrustrootsTheme {
                var query by remember { mutableStateOf("") }
                val enabled = query.length >= 3
                Box(Modifier.width(320.dp).background(Color(0xFF00FF00))) {
                    SubmittedSearchField(
                        value = query,
                        onValueChange = { query = it },
                        label = "Name or username",
                        clearLabel = "Clear member search",
                        searchLabel = "Search members",
                        onSearch = { submissions++ },
                        searchEnabled = enabled,
                        modifier = Modifier.testTag("submittedSearchField"),
                        searchMode = { Text("Members") },
                    )
                }
            }
        }

        compose.onNodeWithText("Members").assertIsDisplayed()
        compose.onNodeWithTag("submittedSearchField").performTextInput("ab")
        compose.onNodeWithTag("submittedSearchField").performImeAction()
        compose.onNodeWithContentDescription("Search members").assertIsNotEnabled()
        assertEquals(0, submissions)

        compose.onNodeWithTag("submittedSearchField").performTextInput("c")
        compose.onNodeWithContentDescription("Search members")
            .assertIsDisplayed()
            .assertWidthIsAtLeast(48.dp)
            .assertHeightIsAtLeast(48.dp)
        compose.onNodeWithContentDescription("Clear member search")
            .assertWidthIsAtLeast(48.dp)
            .assertHeightIsAtLeast(48.dp)
        assertRoundedCornerShowsContrastingBackground("submittedSearchField")
        assertWithinCompactField(
            fieldTag = "submittedSearchField",
            clearLabel = "Clear member search",
            searchLabel = "Search members",
            modeText = "Members",
        )
        compose.onNodeWithTag("submittedSearchField").performImeAction()
        assertEquals(1, submissions)
        hideTestKeyboard()
        captureUsabilityScreenshot(compose, "android_submitted_search_control")

        compose.onNodeWithContentDescription("Clear member search").performClick()
        compose.onNodeWithContentDescription("Clear member search").assertDoesNotExist()
        compose.onNodeWithContentDescription("Search members").assertIsNotEnabled()
        assertEquals(1, submissions)
    }

    private fun assertWithinCompactField(
        fieldTag: String,
        clearLabel: String,
        searchLabel: String? = null,
        modeText: String? = null,
    ) {
        val field = compose.onNodeWithTag(fieldTag).fetchSemanticsNode().boundsInRoot
        val clear = compose.onNodeWithContentDescription(clearLabel).fetchSemanticsNode().boundsInRoot
        val compactWidthPx = with(compose.density) { 320.dp.toPx() }
        assertTrue("Search field should fit within 320dp", field.width <= compactWidthPx + 1f)
        assertTrue(
            "Clear action should remain inside the compact field",
            clear.left >= field.left && clear.right <= field.right,
        )

        if (searchLabel != null) {
            val search = compose.onNodeWithContentDescription(searchLabel)
                .fetchSemanticsNode().boundsInRoot
            assertTrue("Clear action should appear before the search action", clear.right <= search.left)
            assertTrue("Search action should remain inside the compact field", search.right <= field.right)
        }

        if (modeText != null) {
            val mode = compose.onNodeWithText(modeText, useUnmergedTree = true)
                .fetchSemanticsNode().boundsInRoot
            assertTrue("Leading mode should have a visible layout", mode.width > 0f && mode.height > 0f)
            assertTrue(
                "Leading mode should fit inside the compact field",
                mode.left >= field.left && mode.right <= field.right,
            )
            assertTrue("Leading mode should not overlap the clear action", mode.right <= clear.left)
        }
    }

    private fun assertRoundedCornerShowsContrastingBackground(fieldTag: String) {
        val pixels = compose.onNodeWithTag(fieldTag).captureToImage().toPixelMap()
        val corner = pixels[1, 1]
        val interior = pixels[pixels.width / 2, pixels.height - 2]
        val contrastingGreen = Color(0xFF00FF00)

        assertTrue("$fieldTag should reveal the contrasting box at its rounded corner", corner.green > 0.9f)
        assertTrue(
            "$fieldTag should paint an interior distinct from the contrasting background",
            colorDistanceSquared(interior, contrastingGreen) > 0.25f,
        )
    }

    private fun colorDistanceSquared(first: Color, second: Color): Float {
        val red = first.red - second.red
        val green = first.green - second.green
        val blue = first.blue - second.blue
        return red * red + green * green + blue * blue
    }
}
