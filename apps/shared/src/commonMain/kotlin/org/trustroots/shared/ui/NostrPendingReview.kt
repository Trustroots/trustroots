package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class NostrPendingReviewState {
    internal var expired by mutableStateOf(true)
        private set

    fun update(expired: Boolean) {
        this.expired = expired
    }
}

@Composable
internal fun NostrPendingReview(
    state: NostrPendingReviewState,
    destination: String,
    onApprove: () -> Unit,
    onDeny: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val expired = state.expired
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PilotText(destination)
        if (expired) {
            PilotError("This request expired. Retry in Nostranslation.")
        }
        PilotButton(
            label = "Approve signature",
            enabled = !expired,
            primary = true,
            modifier = Modifier.fillMaxWidth(),
            onClick = onApprove,
        )
        PilotButton(
            label = if (expired) "Dismiss" else "Deny",
            modifier = Modifier.fillMaxWidth(),
            destructive = true,
            onClick = onDeny,
        )
    }
}
