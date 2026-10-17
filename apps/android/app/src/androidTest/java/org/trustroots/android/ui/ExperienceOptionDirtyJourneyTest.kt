package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ExperienceOptionDirtyJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun hostingAlonePromptsBeforeSystemBackAndPreservesChoice() {
        assertSingleOptionDirty(hostedCheckboxIndex = 1)
    }

    @Test fun beingAGuestAlonePromptsBeforeSystemBackAndPreservesChoice() {
        assertSingleOptionDirty(hostedCheckboxIndex = 2)
    }

    @Test fun recommendationAlonePromptsBeforeSystemBackAndPreservesChoice() {
        assertSingleOptionDirty(recommendation = true)
    }

    private fun assertSingleOptionDirty(
        hostedCheckboxIndex: Int? = null,
        recommendation: Boolean = false,
    ) {
        val local = LocalTransportFixture { request ->
            error("Unexpected API request: ${request.method} ${request.path}")
        }.also { fixture = it }
        val returnedToProfile = mutableStateOf(false)
        compose.setContent {
            if (returnedToProfile.value) {
                Text("Profile restored")
            } else {
                CreateExperienceScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession(
                        "connect.sid=fictional-session",
                        MobileMember("steady-heron", "Steady Heron"),
                    ),
                    memberID = "member-two",
                    memberLabel = "Quiet Fox",
                    onSessionInvalidated = {},
                    onBack = { returnedToProfile.value = true },
                    onCreated = { returnedToProfile.value = true },
                )
            }
        }

        if (hostedCheckboxIndex != null) {
            val checkboxes = compose.onAllNodes(
                SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox),
            )
            checkboxes[0].assertIsOn()
            checkboxes[hostedCheckboxIndex].performClick().assertIsOn()
            checkboxes[0].assertIsOn()
        } else if (recommendation) {
            compose.onNodeWithText("Not sure").performClick().assertIsSelected()
        }

        pressSystemBackAndAssertDiscardPrompt()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Discard changes?").assertDoesNotExist()

        if (hostedCheckboxIndex != null) {
            compose.onAllNodes(
                SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox),
            )[hostedCheckboxIndex].assertIsOn()
            compose.onAllNodes(
                SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox),
            )[0].assertIsOn()
        } else {
            compose.onNodeWithText("Not sure").assertIsSelected()
        }

        pressSystemBackAndAssertDiscardPrompt()
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithText("Profile restored").assertIsDisplayed()
        compose.runOnIdle { assertTrue("Back and discard must not call the API", local.requests.isEmpty()) }
    }

    private fun pressSystemBackAndAssertDiscardPrompt() {
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
    }
}
