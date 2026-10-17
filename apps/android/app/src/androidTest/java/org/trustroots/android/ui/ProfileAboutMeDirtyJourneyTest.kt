package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ProfileAboutMeDirtyJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun changingOnlyAboutMePromptsBeforeDiscardingOnSystemBack() {
        val local = LocalTransportFixture { request ->
            error("Unexpected API request: ${request.method} ${request.path}")
        }.also { fixture = it }
        val onCancelCalls = AtomicInteger()
        var editing by mutableStateOf(true)
        val initialDescription = "A fictional description of a quiet stay."
        val editedDescription = "A fictional description with a welcoming garden."

        compose.setContent {
            TrustrootsTheme {
                if (editing) {
                    EditProfileScreen(
                        api = MobileApiClient(local.baseURL),
                        session = MemberSession(
                            "connect.sid=fictional-session",
                            MobileMember("quiet-fox", "Quiet Fox"),
                        ),
                        profile = MemberProfile(
                            id = "fictional-member",
                            username = "quiet-fox",
                            displayName = "Quiet Fox",
                            tagline = "A fictional profile tagline.",
                            description = initialDescription,
                            location = "Fictional Bay",
                            locationLiving = "Fictional Bay",
                            locationFrom = "Imaginary Coast",
                            languages = listOf("eng"),
                        ),
                        onSessionInvalidated = {},
                        onCancel = {
                            onCancelCalls.incrementAndGet()
                            editing = false
                        },
                        onSaved = {},
                    )
                } else {
                    androidx.compose.material3.Text("Profile screen")
                }
            }
        }

        compose.onNodeWithText("About me").performScrollTo().performTextReplacement(editedDescription)
        compose.onNodeWithText("Name").assertIsDisplayed()
        compose.onNodeWithText("Tagline").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }

        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("About me").performScrollTo().assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(editedDescription)),
        )
        assertEquals(0, onCancelCalls.get())

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithText("Profile screen").assertIsDisplayed()
        compose.waitUntil(5_000) { onCancelCalls.get() == 1 }
        assertEquals(1, onCancelCalls.get())
        assertEquals(0, local.requests.size)
        compose.onAllNodesWithText("Save changes").assertCountEquals(0)
    }
}
