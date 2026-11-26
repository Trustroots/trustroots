package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.ComposeUIViewController

fun HostingAvailabilitySettingsViewController(
    state: HostingAvailabilitySettingsState,
    onHosting: (String) -> Unit,
    onMeeting: (String) -> Unit,
    onAdjustGuests: (Int) -> Unit,
    onCirclesOnly: (Boolean) -> Unit,
    onHeight: (Double) -> Unit,
) = MeasuredHostingSettings("hosting-availability-settings", onHeight) { modifier ->
    HostingAvailabilitySettings(state, onHosting, onMeeting, onAdjustGuests, onCirclesOnly, modifier)
}

fun HostingDetailsSettingsViewController(
    state: HostingDetailsSettingsState,
    onDescription: (String) -> Unit,
    onUnavailableReason: (String) -> Unit,
    onVolunteering: (Boolean) -> Unit,
    onTextFocus: (Boolean) -> Unit,
    onHeight: (Double) -> Unit,
) = MeasuredHostingSettings("hosting-details-settings", onHeight) { modifier ->
    HostingDetailsSettings(state, onDescription, onUnavailableReason, onVolunteering, onTextFocus, modifier)
}

private fun MeasuredHostingSettings(
    tag: String,
    onHeight: (Double) -> Unit,
    content: @Composable (Modifier) -> Unit,
) = ComposeUIViewController {
    val density = LocalDensity.current
    // SwiftUI's Form needs the embedded section's natural height at its current width.
    Box(Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true)) {
        content(
            Modifier.fillMaxWidth()
                .testTag(tag)
                .onSizeChanged { onHeight(with(density) { it.height.toDp().value.toDouble() }) },
        )
    }
}
