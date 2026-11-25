package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun MemberReportActions(
    canSubmit: Boolean,
    isSending: Boolean,
    error: String?,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        error?.let { PilotError(it) }
        PilotButton(
            if (isSending) "Sending…" else "Send report",
            enabled = canSubmit && !isSending,
            primary = true,
            modifier = Modifier.fillMaxWidth().testTag("report-member-send"),
            onClick = onSend,
        )
    }
}

@Composable
internal fun MemberReportConfirmation(modifier: Modifier = Modifier) {
    Column(
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PilotTitle("Report sent")
        PilotText("Thank you. The Trustroots support team will review your report.")
    }
}
