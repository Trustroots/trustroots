package org.trustroots.shared.ui

import androidx.compose.foundation.layout.size
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitInteropProperties
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIView

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun OfferMapActionViewController(
    action: OfferMapAction,
    surfaceArgb: Long,
    onTap: () -> Unit,
    createIcon: () -> UIView,
) = ComposeUIViewController(configure = { opaque = false }) {
    OfferMapActionButton(action, Color(surfaceArgb), onTap) {
        UIKitView(
            factory = createIcon,
            modifier = Modifier.size(18.dp),
            properties = UIKitInteropProperties(interactionMode = null),
        )
    }
}
