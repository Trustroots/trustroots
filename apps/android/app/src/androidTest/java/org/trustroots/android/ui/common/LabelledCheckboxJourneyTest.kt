package org.trustroots.android.ui.common

import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LabelledCheckboxJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun labelIsTheCheckboxAndTheWholeRowTogglesIt() {
        val checked = mutableStateOf(false)
        val changes = mutableListOf<Boolean>()
        compose.setContent {
            MaterialTheme {
                LabelledCheckbox(
                    label = "Share updates",
                    checked = checked.value,
                    onCheckedChange = { checked.value = it; changes += it },
                    modifier = Modifier.testTag(ROW_TAG),
                )
            }
        }

        val row = compose.onNodeWithTag(ROW_TAG)
        row.assertIsEnabled()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox))
            .assertTextEquals("Share updates")
            .assertIsOff()
        val rowHeight = row.fetchSemanticsNode().boundsInRoot.height
        assertTrue("Checkbox row should meet the 48dp touch target", with(compose.density) { rowHeight.toDp().value >= 48f })

        row.performTouchInput {
            click(Offset(width - 2f, height / 2f))
        }
        row.assertIsOn()
        assertEquals(listOf(true), changes)

        row.performClick().assertIsOff()
        assertEquals(listOf(true, false), changes)
    }

    @Test fun disabledCheckboxExposesDisabledStateAndEmitsNoChange() {
        val changes = mutableListOf<Boolean>()
        compose.setContent {
            MaterialTheme {
                LabelledCheckbox(
                    label = "Share updates",
                    checked = false,
                    enabled = false,
                    onCheckedChange = changes::add,
                    modifier = Modifier.testTag(ROW_TAG),
                )
            }
        }

        val row = compose.onNodeWithTag(ROW_TAG)
        row.assertIsNotEnabled().assertIsOff()
        row.performTouchInput { click() }
        row.assertIsOff()
        assertTrue("Disabled checkboxes must not emit changes", changes.isEmpty())
    }

    private companion object {
        const val ROW_TAG = "labelledCheckbox"
    }
}
