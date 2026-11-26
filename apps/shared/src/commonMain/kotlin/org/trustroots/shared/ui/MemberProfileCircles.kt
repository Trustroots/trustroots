package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

data class MemberProfileCircle(val id: String, val label: String)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MemberProfileCircles(
    circles: List<MemberProfileCircle>,
    onOpen: (String) -> Unit,
    modifier: Modifier,
) {
    val palette = pilotPalette
    val chip = RoundedCornerShape(50)
    FlowRow(
        modifier.background(palette.surface, RoundedCornerShape(16.dp)).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        circles.forEach { circle ->
            key(circle.id) {
                Box(
                    Modifier.heightIn(min = 44.dp).clip(chip)
                        .background(palette.accent.copy(alpha = 0.12f))
                        .clickable(role = Role.Button) { onOpen(circle.id) }
                        .testTag("profile-circle-${circle.id}").padding(horizontal = 12.dp, vertical = 7.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    PilotText(circle.label, colour = palette.accent, strong = true)
                }
            }
        }
    }
}
