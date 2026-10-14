package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class FormNavigationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private fun showEditor() {
        compose.setContent {
            TrustrootsTheme {
                val guard = remember { mutableStateOf<LeaveGuard?>(null) }
                var closed by remember { mutableStateOf(false) }
                CompositionLocalProvider(LocalLeaveGuard provides guard) {
                    Column(Modifier.fillMaxSize()) {
                        TextButton(onClick = {
                            val leave = { closed = true }
                            guard.value?.invoke(leave) ?: leave()
                        }) { Text("Open circles") }
                        if (closed) Text("Editor closed") else EditProfileScreen(
                            api = MobileApiClient("http://127.0.0.1:1"),
                            session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                            profile = MemberProfile("member-one", "quiet-fox", "Quiet Fox", "Travelling slowly", "Hello travellers", null, languages = listOf("eng")),
                            onSessionInvalidated = {},
                            onCancel = { closed = true },
                            onSaved = {},
                        )
                    }
                }
            }
        }
    }

    @Test fun protectsChangesFromCancelSystemBackAndPrimaryNavigation() {
        showEditor()
        compose.onNodeWithText("Tagline").performTextReplacement("Exploring together")
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Exploring together").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Open circles").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_discard_changes")
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithText("Editor closed").assertIsDisplayed()
    }

    @Test fun uneditedFormClosesWithoutConfirmation() {
        showEditor()
        captureUsabilityScreenshot(compose, "android_edit_profile")
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Discard changes?").assertDoesNotExist()
        compose.onNodeWithText("Editor closed").assertIsDisplayed()
    }

    @Test fun primaryNavigationWaitsForSaveToFinish() {
        compose.setContent {
            val guard = remember { mutableStateOf<LeaveGuard?>(null) }
            var closed by remember { mutableStateOf(false) }
            var saving by remember { mutableStateOf(true) }
            CompositionLocalProvider(LocalLeaveGuard provides guard) {
                val cancel = rememberFormCancel(false, saving) { closed = true }
                Column {
                    TextButton(onClick = cancel) { Text("Cancel form") }
                    TextButton(onClick = { guard.value?.invoke { closed = true } }) { Text("Navigate") }
                    TextButton(onClick = { saving = false }) { Text("Finish save") }
                    if (closed) Text("Closed")
                }
            }
        }
        compose.onNodeWithText("Cancel form").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Closed").assertDoesNotExist()
        compose.onNodeWithText("Finish save").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Closed").assertIsDisplayed()
    }
}
