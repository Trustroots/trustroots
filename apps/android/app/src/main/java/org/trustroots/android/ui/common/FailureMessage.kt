package org.trustroots.android.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MobileApiException

/** Context-free error identity retained by screen state until it is rendered. */
internal data class UiFailure(
    val serverMessage: String? = null,
    val apiKind: ApiFailureKind? = null,
    val fallback: UiFailureFallback,
)

internal enum class UiFailureFallback {
    REACH_TRUSTROOTS,
    SESSION_EXPIRED,
    CIRCLES_LOAD,
    CIRCLE_MEMBERSHIPS_LOAD,
    CIRCLE_MEMBERS_LOAD,
    CIRCLE_MEMBERSHIP_UPDATE,
    SEND_MESSAGE,
    LOAD_CONVERSATION,
    LOAD_CONTACTS,
    LOAD_MESSAGES,
    SAVE_PROFILE,
    SEARCH_MEMBERS,
    HOST_SEARCH,
    PLACE_SEARCH,
    LOAD_HOST,
    HOST_OFFER_LOAD,
    HOST_OFFER_SAVE,
    SHARE_EXPERIENCE,
    ACCOUNT_LOAD,
    ACCOUNT_SAVE,
    PASSWORD_CHANGE,
    LOAD_PROFILE,
}

internal fun Throwable.toUiFailure(fallback: UiFailureFallback): UiFailure {
    val apiFailure = this as? MobileApiException
    return UiFailure(
        serverMessage = apiFailure?.serverMessage,
        apiKind = apiFailure?.failureKind,
        fallback = fallback,
    )
}

@Composable
internal fun resolveFailureMessage(failure: UiFailure): String {
    failure.serverMessage?.takeIf(String::isNotBlank)?.let { return it }
    val apiResource = when (failure.apiKind) {
        ApiFailureKind.SIGN_IN_REJECTED -> R.string.api_sign_in_rejected
        ApiFailureKind.MISSING_SESSION -> R.string.api_missing_session
        ApiFailureKind.REQUEST_REJECTED -> R.string.api_request_rejected
        null -> null
    }
    return stringResource(apiResource ?: failure.fallback.resource)
}

private val UiFailureFallback.resource: Int
    get() = when (this) {
        UiFailureFallback.REACH_TRUSTROOTS -> R.string.screen_could_not_reach_trustroots
        UiFailureFallback.SESSION_EXPIRED -> R.string.screen_sign_in_session_expired
        UiFailureFallback.CIRCLES_LOAD -> R.string.screen_circles_load_error
        UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD -> R.string.screen_circle_memberships_load_error
        UiFailureFallback.CIRCLE_MEMBERS_LOAD -> R.string.screen_circle_members_load_error
        UiFailureFallback.CIRCLE_MEMBERSHIP_UPDATE -> R.string.screen_circle_membership_update_error
        UiFailureFallback.SEND_MESSAGE -> R.string.screen_send_message_error
        UiFailureFallback.LOAD_CONVERSATION -> R.string.screen_load_conversation_error
        UiFailureFallback.LOAD_CONTACTS -> R.string.screen_contacts_load_error
        UiFailureFallback.LOAD_MESSAGES -> R.string.screen_messages_load_error
        UiFailureFallback.SAVE_PROFILE -> R.string.screen_profile_save_error
        UiFailureFallback.SEARCH_MEMBERS -> R.string.screen_search_members_error
        UiFailureFallback.HOST_SEARCH -> R.string.screen_host_search_error
        UiFailureFallback.PLACE_SEARCH -> R.string.screen_place_search_error
        UiFailureFallback.LOAD_HOST -> R.string.screen_load_host_error
        UiFailureFallback.HOST_OFFER_LOAD -> R.string.screen_host_offer_load_error
        UiFailureFallback.HOST_OFFER_SAVE -> R.string.screen_host_offer_save_error
        UiFailureFallback.SHARE_EXPERIENCE -> R.string.screen_experience_share_error
        UiFailureFallback.ACCOUNT_LOAD -> R.string.screen_account_load_error
        UiFailureFallback.ACCOUNT_SAVE -> R.string.screen_account_save_error
        UiFailureFallback.PASSWORD_CHANGE -> R.string.screen_password_change_error
        UiFailureFallback.LOAD_PROFILE -> R.string.profile_load_error
    }
