package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun MemberProfileText(title: String?, text: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (title != null) {
            PilotText(title, modifier = Modifier.semantics { heading() }, strong = true)
        }
        PilotText(text)
    }
}

@Composable
internal fun MemberProfileDetails(
    lastLogin: String,
    replyRate: String,
    replyTime: String?,
    living: String?,
    origin: String?,
    onLocation: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Column(
            Modifier.fillMaxWidth()
                .background(pilotPalette.surface, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PilotText("Activity", modifier = Modifier.semantics { heading() }, strong = true)
            ActivityRow("Last login", lastLogin)
            ActivityRow("Reply rate", replyRate)
            replyTime?.let { ActivityRow("Usually replies", it) }
        }
        if (living != null || origin != null) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                living?.let {
                    PilotButton("Lives in $it", modifier = Modifier.fillMaxWidth()) { onLocation(it) }
                }
                origin?.let {
                    PilotButton("From $it", modifier = Modifier.fillMaxWidth()) { onLocation(it) }
                }
            }
        }
    }
}

@Composable
private fun ActivityRow(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        PilotText(label)
        PilotText(value, strong = true)
    }
}
