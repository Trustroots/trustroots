package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class HostingDetailsSettingsState {
    internal var content by mutableStateOf(HostingDetailsContent())
        private set

    fun update(
        description: String,
        unavailableReason: String,
        isUnavailable: Boolean,
        descriptionTooShort: Boolean,
        volunteering: Boolean,
        enabled: Boolean,
    ) {
        content = HostingDetailsContent(
            description, unavailableReason, isUnavailable, descriptionTooShort, volunteering, enabled,
        )
    }

    internal fun editDescription(value: String) { content = content.copy(description = value) }

    internal fun editUnavailableReason(value: String) { content = content.copy(unavailableReason = value) }

    internal fun editVolunteering(value: Boolean) { content = content.copy(volunteering = value) }
}

internal data class HostingDetailsContent(
    val description: String = "",
    val unavailableReason: String = "",
    val isUnavailable: Boolean = false,
    val descriptionTooShort: Boolean = false,
    val volunteering: Boolean = false,
    val enabled: Boolean = false,
)

@Composable
internal fun HostingDetailsSettings(
    state: HostingDetailsSettingsState,
    onDescription: (String) -> Unit,
    onUnavailableReason: (String) -> Unit,
    onVolunteering: (Boolean) -> Unit,
    onTextFocus: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val content = state.content
    var descriptionFocused by remember { mutableStateOf(false) }
    var reasonFocused by remember { mutableStateOf(false) }
    val textFocused = descriptionFocused || (content.isUnavailable && reasonFocused)
    LaunchedEffect(textFocused) { onTextFocus(textFocused) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HostingDetailsField(
            "Hosting description", "hosting-description", content.description, content.enabled,
            minLines = 3, maxLines = 7, onFocus = { descriptionFocused = it },
        ) {
            state.editDescription(it)
            onDescription(it)
        }
        if (content.isUnavailable) {
            HostingDetailsField(
                "Why you are not hosting", "hosting-unavailable-reason", content.unavailableReason,
                content.enabled, minLines = 2, maxLines = 6, onFocus = { reasonFocused = it },
            ) {
                state.editUnavailableReason(it)
                onUnavailableReason(it)
            }
        } else if (content.descriptionTooShort) {
            PilotText("Enter at least five characters in your hosting description.")
        }
        HostingSettingSwitch(
            "Welcome help from volunteering guests", "hosting-volunteering", content.volunteering, content.enabled,
        ) {
            state.editVolunteering(it)
            onVolunteering(it)
        }
        if (content.volunteering) {
            PilotText("Explain what help you need, whether it is optional or expected, and what you offer guests.")
        }
    }
}

@Composable
private fun HostingDetailsField(
    label: String,
    tag: String,
    value: String,
    enabled: Boolean,
    minLines: Int,
    maxLines: Int,
    onFocus: (Boolean) -> Unit,
    onChange: (String) -> Unit,
) {
    val palette = pilotPalette
    val shape = RoundedCornerShape(10.dp)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PilotText(label, strong = true)
        BasicTextField(
            value = value,
            onValueChange = onChange,
            modifier = Modifier.fillMaxWidth().testTag(tag)
                .onFocusChanged { onFocus(it.isFocused) }
                .semantics { contentDescription = label },
            enabled = enabled,
            textStyle = TextStyle(color = palette.ink, fontSize = 16.sp, lineHeight = 22.sp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            minLines = minLines,
            maxLines = maxLines,
            cursorBrush = SolidColor(palette.accent),
            decorationBox = { field ->
                Box(
                    Modifier.fillMaxWidth()
                        .background(palette.surface, shape)
                        .border(1.dp, palette.border, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) { field() }
            },
        )
    }
}
