package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.window.ComposeUIViewController

@OptIn(ExperimentalComposeUiApi::class)
fun NostrPendingReviewViewController(
    state: NostrPendingReviewState,
    destination: String,
    onApprove: () -> Unit,
    onDeny: () -> Unit,
    onHeight: (Double) -> Unit,
) = ComposeUIViewController(configure = { opaque = false }) {
    val density = LocalDensity.current
    Box(Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true)) {
        NostrPendingReview(
            state,
            destination,
            onApprove,
            onDeny,
            modifier = Modifier.fillMaxWidth()
                .onSizeChanged { onHeight(with(density) { it.height.toDp().value.toDouble() }) },
        )
    }
}
