package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

private enum class OfferSearchDisplay(val key: String, val label: String) {
    Map("map", "Map"),
    Results("results", "Results"),
    Members("members", "Members"),
}

class OfferSearchDisplayState {
    internal var selectedKey by mutableStateOf(OfferSearchDisplay.Map.key)
        private set

    fun update(selectedKey: String) {
        this.selectedKey = selectedKey
    }
}

@Composable
internal fun OfferSearchDisplaySelector(
    state: OfferSearchDisplayState,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = pilotPalette
    val choiceShape = RoundedCornerShape(9.dp)
    Row(
        modifier.fillMaxWidth()
            .background(palette.surface, RoundedCornerShape(12.dp))
            .padding(3.dp)
            .selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OfferSearchDisplay.entries.forEach { display ->
            val selected = display.key == state.selectedKey
            Box(
                Modifier.weight(1f)
                    .defaultMinSize(minHeight = 44.dp)
                    .clip(choiceShape)
                    .then(if (selected) Modifier.background(palette.accent) else Modifier)
                    .selectable(
                        selected = selected,
                        role = Role.Tab,
                        onClick = { onSelect(display.key) },
                    )
                    .testTag("offer-search-display-${display.key}")
                    .padding(horizontal = 4.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                PilotText(
                    display.label,
                    colour = if (selected) palette.onAccent else palette.ink,
                    strong = selected,
                )
            }
        }
    }
}
