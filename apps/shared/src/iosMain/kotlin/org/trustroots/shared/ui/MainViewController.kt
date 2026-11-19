package org.trustroots.shared.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIView

@OptIn(ExperimentalForeignApi::class)
fun MainViewController(
    gateway: PilotGateway,
    username: String?,
    initialError: String?,
    createConnectionsMap: (List<PilotMapPin>) -> UIView,
) = ComposeUIViewController {
    SharedComposeRoot(
        gateway,
        username,
        initialError,
        renderConnectionsMap = { pins ->
            key(pins) {
                UIKitView(
                    factory = { createConnectionsMap(pins) },
                    modifier = Modifier.fillMaxWidth().height(280.dp),
                )
            }
        },
    )
}
