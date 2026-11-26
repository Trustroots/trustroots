package org.trustroots.shared.ui

import androidx.compose.ui.window.ComposeUIViewController

fun MemberSupportViewController(
    gateway: MemberSupportGateway,
    onFaq: () -> Unit,
) = ComposeUIViewController {
    MemberSupport(gateway, onFaq)
}
