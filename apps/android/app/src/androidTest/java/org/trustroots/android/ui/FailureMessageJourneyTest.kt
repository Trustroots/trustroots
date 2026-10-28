package org.trustroots.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.core.app.ApplicationProvider
import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage

@RunWith(AndroidJUnit4::class)
class FailureMessageJourneyTest {
    @get:Rule val compose = createComposeRule()

    private lateinit var replaceFailure: (UiFailure) -> Unit

    @Test
    fun rendersServerAndApiMessagesBeforeTheScreenFallback() {
        compose.setContent {
            MaterialTheme {
                var failure by remember { mutableStateOf(UiFailure(fallback = UiFailureFallback.LOAD_CONTACTS)) }
                replaceFailure = { failure = it }
                Text(resolveFailureMessage(failure))
            }
        }

        val context = ApplicationProvider.getApplicationContext<Context>()
        assertDisplayed(context.getString(R.string.screen_contacts_load_error))

        val apiMessages = mapOf(
            ApiFailureKind.SIGN_IN_REJECTED to R.string.api_sign_in_rejected,
            ApiFailureKind.MISSING_SESSION to R.string.api_missing_session,
            ApiFailureKind.REQUEST_REJECTED to R.string.api_request_rejected,
        )
        apiMessages.forEach { (kind, resource) ->
            show(UiFailure(apiKind = kind, fallback = UiFailureFallback.LOAD_CONTACTS))
            assertDisplayed(context.getString(resource))
        }

        show(UiFailure(serverMessage = "A fictional server message", apiKind = ApiFailureKind.MISSING_SESSION, fallback = UiFailureFallback.LOAD_CONTACTS))
        assertDisplayed("A fictional server message")
        show(UiFailure(serverMessage = "  ", fallback = UiFailureFallback.LOAD_CONTACTS))
        assertDisplayed(context.getString(R.string.screen_contacts_load_error))
    }

    @Test
    fun rendersEveryScreenSpecificFallback() {
        val expectedResources = mapOf(
            UiFailureFallback.REACH_TRUSTROOTS to R.string.screen_could_not_reach_trustroots,
            UiFailureFallback.SESSION_EXPIRED to R.string.screen_sign_in_session_expired,
            UiFailureFallback.CIRCLES_LOAD to R.string.screen_circles_load_error,
            UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD to R.string.screen_circle_memberships_load_error,
            UiFailureFallback.CIRCLE_MEMBERS_LOAD to R.string.screen_circle_members_load_error,
            UiFailureFallback.CIRCLE_MEMBERSHIP_UPDATE to R.string.screen_circle_membership_update_error,
            UiFailureFallback.SEND_MESSAGE to R.string.screen_send_message_error,
            UiFailureFallback.LOAD_CONVERSATION to R.string.screen_load_conversation_error,
            UiFailureFallback.LOAD_CONTACTS to R.string.screen_contacts_load_error,
            UiFailureFallback.LOAD_MESSAGES to R.string.screen_messages_load_error,
            UiFailureFallback.SAVE_PROFILE to R.string.screen_profile_save_error,
            UiFailureFallback.SEARCH_MEMBERS to R.string.screen_search_members_error,
            UiFailureFallback.HOST_SEARCH to R.string.screen_host_search_error,
            UiFailureFallback.PLACE_SEARCH to R.string.screen_place_search_error,
            UiFailureFallback.LOAD_HOST to R.string.screen_load_host_error,
            UiFailureFallback.HOST_OFFER_LOAD to R.string.screen_host_offer_load_error,
            UiFailureFallback.HOST_OFFER_SAVE to R.string.screen_host_offer_save_error,
            UiFailureFallback.SHARE_EXPERIENCE to R.string.screen_experience_share_error,
            UiFailureFallback.ACCOUNT_LOAD to R.string.screen_account_load_error,
            UiFailureFallback.ACCOUNT_SAVE to R.string.screen_account_save_error,
            UiFailureFallback.PASSWORD_CHANGE to R.string.screen_password_change_error,
            UiFailureFallback.LOAD_PROFILE to R.string.profile_load_error,
        )
        assertEquals(UiFailureFallback.entries.toSet(), expectedResources.keys)

        compose.setContent {
            MaterialTheme {
                var failure by remember { mutableStateOf(UiFailure(fallback = UiFailureFallback.LOAD_CONTACTS)) }
                replaceFailure = { failure = it }
                Text(resolveFailureMessage(failure))
            }
        }

        expectedResources.forEach { (fallback, resource) ->
            show(UiFailure(fallback = fallback))
            assertDisplayed(ApplicationProvider.getApplicationContext<Context>().getString(resource))
        }
    }

    private fun show(failure: UiFailure) {
        compose.runOnIdle { replaceFailure(failure) }
    }

    private fun assertDisplayed(message: String) {
        compose.onNodeWithText(message).assertIsDisplayed()
    }
}
