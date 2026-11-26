package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.ComposeUIViewController

fun NostrReviewAlertsViewController(
    state: NostrReviewAlertsState,
    onToggle: () -> Unit,
    onHeight: (Double) -> Unit,
) = ComposeUIViewController {
    val density = LocalDensity.current
    Box(Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true)) {
        NostrReviewAlerts(
            state,
            onToggle,
            modifier = Modifier.fillMaxWidth()
                .testTag("nostranslation-review-alerts")
                .onSizeChanged { onHeight(with(density) { it.height.toDp().value.toDouble() }) },
        )
    }
}
