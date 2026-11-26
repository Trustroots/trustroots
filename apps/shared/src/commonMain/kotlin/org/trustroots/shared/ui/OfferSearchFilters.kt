package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

enum class OfferSearchToggle { Hosts, Meet, Volunteering, CommunityNotes, ConnectionsOnly }

enum class OfferSearchActivity(val label: String) {
    PastMonth("Past month"),
    PastSixMonths("Past 6 months"),
    AnyTime("Any time"),
}

data class OfferSearchCircle(val id: String, val label: String, val selected: Boolean)

data class OfferSearchFilterSelection(
    val hosts: Boolean,
    val meet: Boolean,
    val volunteering: Boolean,
    val communityNotes: Boolean,
    val connectionsOnly: Boolean,
    val activity: OfferSearchActivity,
    val languageCount: Int,
    val circles: List<OfferSearchCircle>,
)

class OfferSearchFiltersState {
    internal var selection by mutableStateOf<OfferSearchFilterSelection?>(null)
        private set

    fun update(selection: OfferSearchFilterSelection) {
        this.selection = selection
    }
}

@Composable
internal fun OfferSearchFilters(
    state: OfferSearchFiltersState,
    onToggle: (OfferSearchToggle) -> Unit,
    onActivity: (OfferSearchActivity) -> Unit,
    onLanguages: () -> Unit,
    onCircle: (String) -> Unit,
) {
    val selection = state.selection ?: return
    Column(
        Modifier.fillMaxSize()
            .background(pilotPalette.background)
            .testTag("compose-offer-search-filters")
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        FilterSection("Show") {
            FilterToggle("Hosts", "offer-filter-hosts", selection.hosts) { onToggle(OfferSearchToggle.Hosts) }
            FilterToggle("Meet", "offer-filter-meet", selection.meet) { onToggle(OfferSearchToggle.Meet) }
            FilterToggle("Offers volunteering", "offer-filter-volunteering", selection.volunteering) {
                onToggle(OfferSearchToggle.Volunteering)
            }
            FilterToggle(
                "Community Notes via Nostroots",
                "offer-filter-community-notes",
                selection.communityNotes && !selection.connectionsOnly,
                enabled = !selection.connectionsOnly,
            ) { onToggle(OfferSearchToggle.CommunityNotes) }
        }
        FilterSection("Members") {
            FilterToggle("My connections only", "offer-filter-connections-only", selection.connectionsOnly) {
                onToggle(OfferSearchToggle.ConnectionsOnly)
            }
            PilotText("Last active", strong = true)
            FlowRow(
                Modifier.selectableGroup(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OfferSearchActivity.entries.forEach { option ->
                    val selected = selection.activity == option
                    val palette = pilotPalette
                    Box(
                        Modifier.clip(RoundedCornerShape(12.dp))
                            .background(if (selected) palette.accent else palette.surface)
                            .selectable(selected, role = Role.RadioButton) { onActivity(option) }
                            .testTag("offer-filter-activity-${option.name}")
                            .defaultMinSize(minHeight = 44.dp)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        PilotText(option.label, colour = if (selected) palette.onAccent else palette.ink)
                    }
                }
            }
            val languageCount = if (selection.languageCount == 0) "Any" else selection.languageCount.toString()
            PilotButton(
                "Spoken languages · $languageCount",
                modifier = Modifier.fillMaxWidth().testTag("offer-filter-languages"),
                onClick = onLanguages,
            )
        }
        FilterSection("Circles") {
            if (selection.circles.isEmpty()) {
                PilotText("Loading circles…")
            } else {
                selection.circles.forEach { circle ->
                    FilterToggle(circle.label, "offer-filter-circle-${circle.id}", circle.selected) {
                        onCircle(circle.id)
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PilotText(title, Modifier.semantics { heading() }, strong = true)
        content()
    }
}

@Composable
private fun FilterToggle(
    label: String,
    tag: String,
    selected: Boolean,
    enabled: Boolean = true,
    onToggle: () -> Unit,
) {
    val palette = pilotPalette
    val emphasis = if (enabled) 1f else 0.6f
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(palette.surface)
            .toggleable(selected, enabled, role = Role.Switch) { onToggle() }
            .testTag(tag)
            .defaultMinSize(minHeight = 48.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PilotText(label, Modifier.weight(1f), colour = palette.ink.copy(alpha = emphasis))
        Box(
            Modifier.size(width = 42.dp, height = 24.dp)
                .background(if (selected) palette.accent else palette.background, CircleShape)
                .border(1.dp, palette.border, CircleShape)
                .padding(3.dp),
            contentAlignment = if (selected) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(
                Modifier.size(18.dp).background(
                    (if (selected) palette.onAccent else palette.border).copy(alpha = emphasis),
                    CircleShape,
                ),
            )
        }
    }
}
