package org.trustroots.android.ui.profile

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.ApiFailureKind

@RunWith(AndroidJUnit4::class)
class ProfileSafetyControlsJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun retryRemainsDisabledWhileBlockStatusIsLoading() {
        compose.setContent {
            MaterialTheme {
                ProfileSafetyNotice(
                    displayName = "Quiet Fox",
                    state = MemberProfileUiState(
                        isLoadingBlock = true,
                        blockFailure = MemberProfileFailure(MemberProfileFailureReason.BLOCK_STATUS),
                    ),
                    onRetry = {},
                )
            }
        }

        compose.onNodeWithText("Retry").assertIsNotEnabled()
    }

    @Test fun blockFailureUsesFallbackWithoutApiDetails() {
        compose.setContent {
            MaterialTheme {
                ProfileSafetyNotice(
                    displayName = "Quiet Fox",
                    state = MemberProfileUiState(
                        blockFailure = MemberProfileFailure(MemberProfileFailureReason.BLOCK_STATUS),
                    ),
                    onRetry = {},
                )
            }
        }
        compose.onNodeWithText("Could not check whether this member is blocked.").assertIsDisplayed()
    }

    @Test fun blockFailureResolvesApiKindWithoutServerMessage() {
        compose.setContent {
            MaterialTheme {
                ProfileSafetyNotice(
                    displayName = "Quiet Fox",
                    state = MemberProfileUiState(
                        blockFailure = MemberProfileFailure(
                            MemberProfileFailureReason.BLOCK_STATUS,
                            apiKind = ApiFailureKind.REQUEST_REJECTED,
                        ),
                    ),
                    onRetry = {},
                )
            }
        }
        compose.onNodeWithText("Could not check whether this member is blocked.").assertDoesNotExist()
        compose.onNodeWithText("The request was not accepted.").assertIsDisplayed()
    }
}
