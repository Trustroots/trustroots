package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

class NostrReviewAlertsState {
    internal var content by mutableStateOf(NostrReviewAlertsContent())
        private set

    fun update(enabled: Boolean, status: String?) {
        content = NostrReviewAlertsContent(enabled, status)
    }
}

internal data class NostrReviewAlertsContent(
    val enabled: Boolean = false,
    val status: String? = null,
)

@Composable
internal fun NostrReviewAlerts(
    state: NostrReviewAlertsState,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val content = state.content
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PilotButton(
            if (content.enabled) "Disable review alerts" else "Enable review alerts",
            modifier = Modifier.fillMaxWidth(),
            onClick = onToggle,
        )
        content.status?.let { status ->
            PilotText(status, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
    }
}
