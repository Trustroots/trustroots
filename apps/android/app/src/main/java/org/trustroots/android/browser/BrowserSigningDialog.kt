package org.trustroots.android.browser

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import org.trustroots.android.R

@Composable
internal fun BrowserSigningApproval(bridge: AndroidNip07Bridge) {
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        bridge.declineApproval()
    }
    bridge.approval?.let { BrowserSigningDialog(it) }
}

@Composable
private fun BrowserSigningDialog(approval: AndroidNip07Bridge.SigningApproval) {
    AlertDialog(
        onDismissRequest = { approval.decision.complete(false) },
        properties = DialogProperties(securePolicy = SecureFlagPolicy.SecureOn),
        title = { Text(stringResource(R.string.browser_nostr_signing_title, approval.origin)) },
        text = {
            Text(
                text = approval.details,
                modifier = Modifier.verticalScroll(rememberScrollState()),
                style = TextStyle(fontFamily = FontFamily.Monospace, textDirection = TextDirection.Ltr),
            )
        },
        confirmButton = {
            TextButton(onClick = { approval.decision.complete(true) }) {
                Text(stringResource(R.string.browser_nostr_sign_event))
            }
        },
        dismissButton = {
            TextButton(onClick = { approval.decision.complete(false) }) {
                Text(stringResource(R.string.cancel))
            }
        },
    )
}
