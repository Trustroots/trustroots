package org.trustroots.android.ui.profile

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProfileActionBarBranchJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun repeatedMenuButtonActionsToggleAnOpenMenuClosed() {
        compose.setContent {
            MaterialTheme {
                Surface {
                    actionBar(isBlocked = false, safetyBusy = false)
                }
            }
        }

        val capturedClick = requireNotNull(
            compose.onNodeWithTag("profileActionsMenuButton")
                .fetchSemanticsNode().config[SemanticsActions.OnClick].action,
        )

        compose.runOnIdle {
            capturedClick()
            capturedClick()
        }

        compose.waitForIdle()
        compose.onNodeWithTag("profileReportAction").assertDoesNotExist()
        compose.onNodeWithTag("profileActionsMenuButton").performClick()
        compose.onNodeWithTag("profileReportAction").assertIsDisplayed()
    }

    @Test fun blockMenuItemIsDisabledWhileSafetyUpdateIsBusyThenInvokesItsTarget() {
        val safetyBusy = mutableStateOf(true)
        val blockTargets = mutableListOf<Boolean>()
        compose.setContent {
            MaterialTheme {
                Surface {
                    actionBar(
                        isBlocked = true,
                        safetyBusy = safetyBusy.value,
                        onBlock = { blockTargets.add(it) },
                    )
                }
            }
        }

        compose.onNodeWithTag("profileActionsMenuButton").performClick()
        compose.onNodeWithTag("profileBlockAction").assertIsNotEnabled()
        compose.runOnIdle { safetyBusy.value = false }
        compose.onNodeWithTag("profileBlockAction").assertIsEnabled().performClick()

        assertEquals(listOf(false), blockTargets)
    }

    @Composable
    private fun actionBar(
        isBlocked: Boolean?,
        safetyBusy: Boolean,
        onBlock: (Boolean) -> Unit = {},
    ) {
        ProfileActionBar(
            isSelf = false,
            onBack = {},
            onEditProfile = {},
            onMessage = {},
            onShareExperience = {},
            contactAction = null,
            topPadding = 0.dp,
            horizontalInset = PaddingValues.Zero,
            compactTitle = null,
            isBlocked = isBlocked,
            safetyBusy = safetyBusy,
            onBlock = onBlock,
            onReport = {},
        )
    }
}
