package org.trustroots.android.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeNavigationComponentsJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun backButtonExposesItsAccessibleControlAndUsesUpdatedCallbackAndTint() {
        var initialCalls = 0
        var updatedCalls = 0
        var currentCallback by mutableStateOf<() -> Unit>({ initialCalls++ })

        compose.setContent {
            MaterialTheme {
                NativeBackButton(
                    onBack = currentCallback,
                    modifier = Modifier.testTag("customBackButton").size(56.dp),
                    tint = Color.Magenta,
                )
            }
        }

        compose.onNodeWithContentDescription("Back").assertIsDisplayed().assertContentDescriptionEquals("Back")
        compose.onNodeWithTag("customBackButton")
            .assertWidthIsEqualTo(56.dp)
            .assertHeightIsEqualTo(56.dp)

        val pixels = compose.onNodeWithTag("customBackButton").captureToImage().toPixelMap()
        val magentaPixels = (0 until pixels.height).sumOf { y ->
            (0 until pixels.width).count { x ->
                val pixel = pixels[x, y]
                pixel.red > 0.8f && pixel.blue > 0.8f && pixel.green < 0.2f && pixel.alpha > 0.8f
            }
        }
        assertTrue("The back icon should use the requested tint", magentaPixels > 8)

        compose.onNodeWithContentDescription("Back").performClick()
        compose.runOnIdle { currentCallback = { updatedCalls++ } }
        compose.onNodeWithContentDescription("Back").performClick()

        assertEquals(1, initialCalls)
        assertEquals(1, updatedCalls)
    }

    @Test fun backButtonDefaultTintTracksThemeAndUsesUpdatedCallback() {
        var onSurface by mutableStateOf(Color.Magenta)
        var initialCalls = 0
        var updatedCalls = 0
        var currentCallback by mutableStateOf<() -> Unit>({ initialCalls++ })

        compose.setContent {
            MaterialTheme(colorScheme = lightColorScheme(onSurface = onSurface)) {
                NativeBackButton(onBack = currentCallback)
            }
        }

        val backButton = compose.onNodeWithContentDescription("Back")
        backButton.assertIsDisplayed().assertContentDescriptionEquals("Back")
        assertTintPixels(backButton, red = true, green = false, blue = true)

        backButton.performClick()
        compose.runOnIdle {
            onSurface = Color.Cyan
            currentCallback = { updatedCalls++ }
        }

        backButton.assertIsDisplayed()
        assertTintPixels(backButton, red = false, green = true, blue = true)
        backButton.performClick()

        assertEquals(1, initialCalls)
        assertEquals(1, updatedCalls)
    }

    private fun assertTintPixels(
        node: androidx.compose.ui.test.SemanticsNodeInteraction,
        red: Boolean,
        green: Boolean,
        blue: Boolean,
    ) {
        val pixels = node.captureToImage().toPixelMap()
        val matchingPixels = (0 until pixels.height).sumOf { y ->
            (0 until pixels.width).count { x ->
                val pixel = pixels[x, y]
                pixel.alpha > 0.8f &&
                    (if (red) pixel.red > 0.8f else pixel.red < 0.2f) &&
                    (if (green) pixel.green > 0.8f else pixel.green < 0.2f) &&
                    (if (blue) pixel.blue > 0.8f else pixel.blue < 0.2f)
            }
        }
        assertTrue("Back icon pixels should follow the default onSurface tint", matchingPixels > 8)
    }

    @Test fun formActionBarAppliesInsetAndUsesCurrentCallbacksWhileSavingDisablesActions() {
        var saving by mutableStateOf(false)
        var canSave by mutableStateOf(true)
        var horizontalInset by mutableStateOf(0.dp)
        var initialCancelCalls = 0
        var initialSaveCalls = 0
        var updatedCancelCalls = 0
        var updatedSaveCalls = 0
        var onCancel by mutableStateOf<() -> Unit>({ initialCancelCalls++ })
        var onSave by mutableStateOf<() -> Unit>({ initialSaveCalls++ })

        compose.setContent {
            MaterialTheme {
                FormActionBar(
                    title = "Edit profile",
                    saving = saving,
                    canSave = canSave,
                    onCancel = onCancel,
                    onSave = onSave,
                    horizontalInset = PaddingValues(horizontal = horizontalInset),
                )
            }
        }

        compose.onNodeWithText("Edit profile").assertIsDisplayed()
        compose.onNodeWithContentDescription("Cancel").assertIsDisplayed().assertIsEnabled()
        compose.onNodeWithText("Save changes").assertIsDisplayed().assertIsEnabled()
        val title = compose.onNodeWithText("Edit profile")
        val titleLeftWithoutInset = title.fetchSemanticsNode().boundsInRoot.left
        compose.runOnIdle { horizontalInset = 24.dp }
        val titleLeftWithInset = title.fetchSemanticsNode().boundsInRoot.left
        val expectedInset = with(compose.density) { 24.dp.toPx() }
        assertEquals(expectedInset, titleLeftWithInset - titleLeftWithoutInset, 0.5f)

        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Save changes").performClick()

        compose.runOnIdle {
            saving = true
            onCancel = { updatedCancelCalls++ }
            onSave = { updatedSaveCalls++ }
        }
        compose.onNodeWithText("Saving…").assertIsDisplayed().assertIsNotEnabled()
        compose.onNodeWithContentDescription("Cancel").assertIsNotEnabled()

        compose.runOnIdle {
            saving = false
            canSave = false
        }
        compose.onNodeWithContentDescription("Cancel").assertIsEnabled().performClick()
        compose.onNodeWithText("Save changes").assertIsNotEnabled()

        compose.runOnIdle { canSave = true }
        compose.onNodeWithText("Save changes").assertIsEnabled().performClick()

        assertEquals(1, initialCancelCalls)
        assertEquals(1, initialSaveCalls)
        assertEquals(1, updatedCancelCalls)
        assertEquals(1, updatedSaveCalls)
    }
}
