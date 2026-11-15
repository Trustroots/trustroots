package org.trustroots.shared.ui

import androidx.compose.ui.window.ComposeUIViewController

fun MainViewController(gateway: PilotGateway, username: String?, initialError: String?) = ComposeUIViewController {
    SharedComposeRoot(gateway, username, initialError)
}
