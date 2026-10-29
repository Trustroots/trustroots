package org.trustroots.android.ui.common

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MessageMember

@RunWith(AndroidJUnit4::class)
class PresentationBranchContractsJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun presentationFallbacksChooseTheMostSpecificAvailableLabel() {
        compose.setContent {
            MaterialTheme {
                Column {
                    Text(MessageMember(id = null, username = "fallback-name", displayName = "Visible Name").localizedLabel())
                    Text(MessageMember(id = null, username = "  username with spaces  ", displayName = " \t ").localizedLabel())
                    Text(MessageMember(id = null, username = " \t ", displayName = "\n ").localizedLabel())

                    Text(
                        resolveFailureMessage(
                            UiFailure(
                                serverMessage = "A fictional server message.",
                                apiKind = ApiFailureKind.REQUEST_REJECTED,
                                fallback = UiFailureFallback.LOAD_CONTACTS,
                            ),
                        ),
                    )
                    Text(
                        resolveFailureMessage(
                            UiFailure(
                                serverMessage = " \t ",
                                apiKind = ApiFailureKind.REQUEST_REJECTED,
                                fallback = UiFailureFallback.LOAD_CONTACTS,
                            ),
                        ),
                    )
                    Text(
                        resolveFailureMessage(
                            UiFailure(
                                serverMessage = "",
                                fallback = UiFailureFallback.LOAD_CONTACTS,
                            ),
                        ),
                    )
                }
            }
        }

        compose.onNodeWithText("Visible Name").assertIsDisplayed()
        compose.onNodeWithText("  username with spaces  ").assertIsDisplayed()
        compose.onNodeWithText(compose.activity.getString(R.string.profile_photo_default_member_label)).assertIsDisplayed()
        compose.onNodeWithText("A fictional server message.").assertIsDisplayed()
        compose.onNodeWithText(compose.activity.getString(R.string.api_request_rejected)).assertIsDisplayed()
        compose.onNodeWithText(compose.activity.getString(R.string.screen_contacts_load_error)).assertIsDisplayed()
    }
}
