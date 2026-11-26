package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitInteropProperties
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIView

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun OfflineSavedDataNoticeViewController(
    message: String,
    makeIcon: () -> UIView,
    onHeight: (Double) -> Unit,
) = ComposeUIViewController(configure = { opaque = false }) {
    val density = LocalDensity.current
    Box(Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true)) {
        OfflineSavedDataNotice(
            message,
            Modifier.onSizeChanged { onHeight(with(density) { it.height.toDp().value.toDouble() }) },
        ) {
            UIKitView(
                factory = makeIcon,
                modifier = Modifier.size(14.dp),
                properties = UIKitInteropProperties(interactionMode = null),
            )
        }
    }
}
