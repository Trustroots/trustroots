package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun MemberNostrProfileKeyStatus(
    profileLoaded: Boolean,
    hasLinkedKey: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        PilotTitle("Nostr key")
        PilotText("Your local key belongs to this Trustroots server and account. Your private key stays on this device.")
        PilotText("Profile-linked public key", Modifier.semantics { heading() }, strong = true)
        when {
            !profileLoaded -> PilotText("Profile key unavailable. Connect to load your profile.")
            !hasLinkedKey -> PilotText("No linked public key.")
        }
    }
}

@Composable
internal fun MemberNostrLocalKeyStatus(hasLocalKey: Boolean, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        PilotText("Local public key (npub)", Modifier.semantics { heading() }, strong = true)
        if (!hasLocalKey) PilotText("No local key for this account.")
    }
}
