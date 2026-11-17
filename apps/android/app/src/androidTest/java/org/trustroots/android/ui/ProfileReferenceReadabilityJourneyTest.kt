package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.ui.profile.ProfileOverviewSection
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ProfileReferenceReadabilityJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun separatesReferenceAndNamedResponseInLightTheme() = verifyReferences(false)
    @Test fun separatesReferenceAndNamedResponseInDarkTheme() = verifyReferences(true)

    private fun verifyReferences(dark: Boolean) {
        val activity = compose.activity
        val configuration = Configuration(activity.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
                if (dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
        }
        val context = activity.createConfigurationContext(configuration)
        val reference = mutableStateOf(ProfileReference(
            "fictional-reference", MessageMember(null, "steady-heron", "Steady Heron"),
            "A thoughtful visit.", "yes", "Thank you for visiting.", authorWasGuest = true,
        ))
        val owner = mutableStateOf<String?>("quiet-fox")
        var opened: String? = null
        compose.setContent {
            CompositionLocalProvider(LocalContext provides context, LocalConfiguration provides configuration) {
                TrustrootsTheme {
                    Surface {
                        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
                            ProfileOverviewSection(
                                references = listOf(reference.value), showAllReferences = false,
                                onToggleReferences = {}, onOpenRelated = { opened = it },
                                api = MobileApiClient("https://example.invalid"),
                                session = MemberSession("fictional-session", MobileMember("quiet-fox", "Quiet Fox")),
                                responseAuthor = owner.value,
                            )
                        }
                    }
                }
            }
        }
        compose.onNodeWithText("Recommends this member").assertIsDisplayed()
        compose.onNodeWithText("Author was their guest").assertIsDisplayed()
        compose.onNodeWithText("quiet-fox’s response").performScrollTo().assertIsDisplayed()
        val feedback = compose.onNodeWithTag("profileReferenceFeedback-fictional-reference").fetchSemanticsNode().boundsInRoot
        val heading = compose.onNodeWithText("quiet-fox’s response").fetchSemanticsNode().boundsInRoot
        assertTrue("Responses must be separated from the original feedback", heading.top - feedback.bottom >= with(compose.density) { 16.dp.toPx() })
        captureUsabilityScreenshot(compose, "profile-reference-guest-${if (dark) "dark" else "light"}")
        compose.onNodeWithText("Steady Heron").performScrollTo().performClick()
        assertEquals("steady-heron", opened)

        compose.runOnIdle { reference.value = reference.value.copy(recommendation = "no", authorWasGuest = false, authorWasHost = true) }
        compose.onNodeWithText("Does not recommend this member").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Author hosted this member").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "profile-reference-host-${if (dark) "dark" else "light"}")
        compose.runOnIdle { reference.value = reference.value.copy(recommendation = "unknown", authorWasGuest = true) }
        compose.onNodeWithText("Not sure about recommending this member").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Author was their guest").assertIsDisplayed()
        compose.onNodeWithText("Author hosted this member").assertIsDisplayed()
        compose.runOnIdle { reference.value = reference.value.copy(recommendation = null, authorWasGuest = false, authorWasHost = false); owner.value = null }
        compose.onNodeWithText("No recommendation shared").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Response").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Author was their guest").assertDoesNotExist()
        compose.onNodeWithText("Author hosted this member").assertDoesNotExist()
    }
}
