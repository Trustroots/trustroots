package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

class HostingAvailabilitySettingsState {
    internal var content by mutableStateOf(HostingAvailabilityContent())
        private set

    fun update(hosting: String, meeting: String, maxGuests: Int, circlesOnly: Boolean, enabled: Boolean) {
        content = HostingAvailabilityContent(hosting, meeting, maxGuests, circlesOnly, enabled)
    }
}

internal data class HostingAvailabilityContent(
    val hosting: String = "yes",
    val meeting: String = "not-set",
    val maxGuests: Int = 1,
    val circlesOnly: Boolean = false,
    val enabled: Boolean = false,
)

private val availability = listOf("yes" to "Yes", "maybe" to "Maybe", "no" to "No")
private val meetingAvailability = availability + ("not-set" to "Not set")

@Composable
internal fun HostingAvailabilitySettings(
    state: HostingAvailabilitySettingsState,
    onHosting: (String) -> Unit,
    onMeeting: (String) -> Unit,
    onAdjustGuests: (Int) -> Unit,
    onCirclesOnly: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val content = state.content
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AvailabilityOptions(
            "Hosting availability", "hosting-availability", availability,
            content.hosting, content.enabled, onHosting,
        )
        AvailabilityOptions(
            "Meeting availability", "meeting-availability", meetingAvailability,
            content.meeting, content.enabled, onMeeting,
        )
        if (content.hosting != "no") {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PilotText("Maximum guests: ${content.maxGuests}", Modifier.weight(1f))
                PilotButton(
                    "−",
                    enabled = content.enabled && content.maxGuests > 0,
                    modifier = Modifier.testTag("hosting-guests-decrease")
                        .semantics { contentDescription = "Decrease maximum guests" },
                ) { onAdjustGuests(-1) }
                PilotButton(
                    "+",
                    enabled = content.enabled && content.maxGuests < 99,
                    modifier = Modifier.testTag("hosting-guests-increase")
                        .semantics { contentDescription = "Increase maximum guests" },
                ) { onAdjustGuests(1) }
            }
        }
        HostingSettingSwitch(
            "Show only in my circles", "hosting-circles-only", content.circlesOnly, content.enabled, onCirclesOnly,
        )
    }
}

@Composable
private fun AvailabilityOptions(
    label: String,
    tag: String,
    options: List<Pair<String, String>>,
    selection: String,
    enabled: Boolean,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        PilotText(label, Modifier.semantics { heading() }, strong = true)
        FlowRow(
            Modifier.selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            options.forEach { (value, title) ->
                PilotButton(
                    title,
                    enabled = enabled,
                    primary = value == selection,
                    modifier = Modifier.testTag("$tag-$value").semantics { selected = value == selection },
                ) { onSelect(value) }
            }
        }
    }
}

@Composable
internal fun HostingSettingSwitch(
    label: String,
    tag: String,
    checked: Boolean,
    enabled: Boolean,
    onChecked: (Boolean) -> Unit,
) {
    val palette = pilotPalette
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
            .toggleable(checked, enabled = enabled, role = Role.Switch, onValueChange = onChecked)
            .testTag(tag),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PilotText(label, Modifier.weight(1f))
        Box(
            Modifier.size(width = 38.dp, height = 24.dp)
                .background(if (checked) palette.accent else palette.border, CircleShape)
                .padding(3.dp),
            contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(Modifier.size(18.dp).background(palette.background, CircleShape))
        }
    }
}
