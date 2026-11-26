package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun NostrConnectedClient(
    peerPrefix: String,
    onRevoke: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PilotText("Nostranslation client $peerPrefix")
        PilotButton(
            label = "Revoke client",
            modifier = Modifier.fillMaxWidth()
                .testTag("nostranslation-connected-client-revoke")
                .semantics { contentDescription = "Revoke client $peerPrefix" },
            destructive = true,
            onClick = onRevoke,
        )
    }
}
