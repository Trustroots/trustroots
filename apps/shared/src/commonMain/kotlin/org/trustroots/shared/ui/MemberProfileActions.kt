package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun MemberProfileActions(
    canEdit: Boolean,
    messageLabel: String?,
    onEdit: () -> Unit,
    onHosting: () -> Unit,
    onMessage: () -> Unit,
    modifier: Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (canEdit) {
            PilotButton("Edit profile", primary = true, modifier = Modifier.fillMaxWidth(), onClick = onEdit)
            PilotButton("Hosting and meetings", modifier = Modifier.testTag("edit-hosting-offer"), onClick = onHosting)
        }
        if (messageLabel != null) {
            PilotButton(
                "Message",
                primary = true,
                modifier = Modifier.fillMaxWidth().testTag("profile-message")
                    .semantics { contentDescription = messageLabel },
                onClick = onMessage,
            )
        }
    }
}

@Composable
internal fun MemberProfileSafety(
    blockedMessage: String?,
    isUpdating: Boolean,
    error: String?,
    onReport: () -> Unit,
    onToggleBlock: () -> Unit,
    modifier: Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        blockedMessage?.let { PilotText(it) }
        PilotButton("Report member to support", onClick = onReport)
        PilotButton(
            if (blockedMessage == null) "Block" else "Unblock",
            enabled = !isUpdating,
            modifier = Modifier.testTag("profile-block"),
            onClick = onToggleBlock,
        )
        error?.let { PilotError(it) }
    }
}
