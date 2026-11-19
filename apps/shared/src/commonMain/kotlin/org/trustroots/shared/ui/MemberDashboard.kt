package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

/** Shared pilot home. Rendering it never depends on discovery or profile requests. */
@Composable
internal fun MemberDashboard(onProfile: () -> Unit, onInbox: () -> Unit) {
    val uriHandler = LocalUriHandler.current
    var linkFailed by remember { mutableStateOf(false) }

    PilotForm {
        PilotTitle("Home")
        PilotText("Welcome to Trustroots")
        PilotText("Find people, keep in touch and make yourself at home.")
        PilotButton("My profile", onClick = onProfile)
        PilotButton("Messages", primary = true, onClick = onInbox)
        Column(
            modifier = Modifier.fillMaxWidth().testTag("dashboard-nostroots").padding(top = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PilotTitle("Discover Nostroots")
            PilotText("Share local notes and small meetups with the Trustroots community using Nostroots.")
            PilotButton("Learn about Nostroots") {
                linkFailed = runCatching {
                    uriHandler.openUri("https://team.trustroots.org/nostr.html")
                }.isFailure
            }
            if (linkFailed) PilotError("Could not open the introduction. Please try again.")
        }
    }
}
