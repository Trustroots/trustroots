package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
internal fun MemberProfileHosting(
    status: String?,
    meeting: String?,
    description: String?,
    volunteering: Boolean,
    capacity: String?,
    modifier: Modifier,
) {
    val palette = pilotPalette
    val isHosting = status == "yes" || status == "maybe"
    val hostingLabel = when (status) {
        "yes" -> "Hosting travellers"
        "maybe" -> "Maybe hosting"
        else -> "Not hosting currently"
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        meeting?.let { PilotText(it, colour = palette.accent, strong = true) }
        Column(
            Modifier.fillMaxWidth().background(palette.surface, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            PilotText(hostingLabel, colour = if (isHosting) palette.accent else palette.ink, strong = true)
            if (isHosting && volunteering) PilotText("Offers volunteering")
            description?.let { PilotText(it) }
            if (isHosting) capacity?.let { PilotText(it) }
        }
    }
}
