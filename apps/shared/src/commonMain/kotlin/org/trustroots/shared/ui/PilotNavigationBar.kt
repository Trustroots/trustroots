package org.trustroots.shared.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal enum class PilotTab(val label: String) { Home("Home"), Messages("Messages"), Profile("My profile") }

@Composable
internal fun PilotNavigationBar(selected: PilotTab, enabled: Boolean, onSelect: (PilotTab) -> Unit) {
    val palette = pilotPalette
    Row(
        Modifier.fillMaxWidth().background(palette.accent, RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            .selectableGroup(),
    ) {
        PilotTab.entries.forEach { tab ->
            val active = selected == tab
            Column(
                Modifier.weight(1f).defaultMinSize(minHeight = 56.dp)
                    .selectable(selected = active, enabled = enabled, role = Role.Tab, onClick = { onSelect(tab) })
                    .padding(horizontal = 4.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
            ) {
                PilotTabIcon(tab, palette.onAccent)
                BasicText(
                    tab.label,
                    style = TextStyle(
                        color = palette.onAccent,
                        fontSize = 13.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                    ),
                )
            }
        }
    }
}

@Composable
private fun PilotTabIcon(tab: PilotTab, colour: Color) {
    Canvas(Modifier.size(20.dp)) {
        val unit = size.width / 24f
        val outline = Stroke(width = 2.dp.toPx())
        fun polygon(vararg coordinates: Int) = Path().apply {
            moveTo(coordinates[0] * unit, coordinates[1] * unit)
            for (index in 2 until coordinates.size step 2) {
                lineTo(coordinates[index] * unit, coordinates[index + 1] * unit)
            }
            close()
        }
        when (tab) {
            PilotTab.Home -> drawPath(polygon(3, 10, 12, 3, 21, 10, 21, 21, 3, 21), colour, style = outline)
            PilotTab.Messages -> drawPath(polygon(3, 4, 21, 4, 21, 17, 9, 17, 3, 21), colour, style = outline)
            PilotTab.Profile -> {
                drawCircle(colour, radius = 4 * unit, center = Offset(12 * unit, 7 * unit), style = outline)
                drawPath(Path().apply {
                    moveTo(4 * unit, 21 * unit)
                    cubicTo(4 * unit, 11 * unit, 20 * unit, 11 * unit, 20 * unit, 21 * unit)
                }, colour, style = outline)
            }
        }
    }
}
