package org.trustroots.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.PaddingValues
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

/** Opens a conversation through the same decorated Navigation 3 route used by the app. */
@Composable
internal fun ConversationRouteTestHarness(
    api: MobileApiClient,
    session: MemberSession,
    memberID: String,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    TrustrootsTheme {
        MessageInboxScreen(
            api = api,
            session = session,
            onSessionInvalidated = onSessionInvalidated,
            initialMemberID = memberID,
            contentPadding = contentPadding,
        )
    }
}
