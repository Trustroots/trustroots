package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
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
        renderConnectionsMap = { ConnectionsMap(it, createConnectionsMap) },
    )
}

@OptIn(ExperimentalForeignApi::class)
fun SharedHomeViewController(
    gateway: PilotGateway,
    createConnectionsMap: (List<PilotMapPin>) -> UIView,
    openProfile: (String) -> Unit,
) = ComposeUIViewController {
    Box(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        MemberDashboard(
            accountKey = gateway,
            loadNotes = { awaitData(gateway::featuredNotes) },
            loadConnections = { awaitData(gateway::connections) },
            renderConnectionsMap = { ConnectionsMap(it, createConnectionsMap) },
            onConnection = openProfile,
        )
    }
}

@OptIn(ExperimentalForeignApi::class)
@Composable
private fun ConnectionsMap(pins: List<PilotMapPin>, createView: (List<PilotMapPin>) -> UIView) {
    key(pins) {
        UIKitView(
            factory = { createView(pins) },
            modifier = Modifier.fillMaxWidth().height(280.dp),
        )
    }
}
