package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp

enum class MemberExperienceRecommendation(val wireValue: String, internal val label: String) {
    Yes("yes", "Yes"),
    Unknown("unknown", "Not sure"),
    No("no", "No"),
}

data class MemberExperienceDraft(
    val met: Boolean = true,
    val hosted: Boolean = false,
    val wasGuest: Boolean = false,
    val recommendation: MemberExperienceRecommendation = MemberExperienceRecommendation.Yes,
    val feedback: String = "",
) {
    val hasInteraction: Boolean get() = met || hosted || wasGuest
}

class MemberExperienceFormState {
    internal var isSaving by mutableStateOf(false)
        private set
    internal var error by mutableStateOf<String?>(null)
        private set

    fun updateSubmission(isSaving: Boolean, error: String?) {
        this.isSaving = isSaving
        this.error = error
    }
}

@Composable
internal fun MemberExperienceForm(
    state: MemberExperienceFormState,
    onSubmit: (MemberExperienceDraft) -> Unit,
) {
    var draft by remember { mutableStateOf(MemberExperienceDraft()) }
    val focusManager = LocalFocusManager.current
    Column(
        modifier = Modifier.fillMaxSize()
            .background(pilotPalette.background)
            .imePadding()
            .verticalScroll(rememberScrollState())
            .testTag("experience-form")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            PilotText("What happened?", Modifier.semantics { heading() }, strong = true)
            ExperienceInteraction("We met in person", "experience-met", draft.met) {
                draft = draft.copy(met = it)
            }
            ExperienceInteraction("I hosted them", "experience-hosted", draft.hosted) {
                draft = draft.copy(hosted = it)
            }
            ExperienceInteraction("I was their guest", "experience-guest", draft.wasGuest) {
                draft = draft.copy(wasGuest = it)
            }
            PilotText("Select at least one interaction.")
        }
        Column(
            modifier = Modifier.selectableGroup(),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            PilotText("Would you recommend them?", Modifier.semantics { heading() }, strong = true)
            MemberExperienceRecommendation.entries.forEach { recommendation ->
                val selected = draft.recommendation == recommendation
                ExperienceChoice(
                    recommendation.label,
                    selected,
                    Modifier.testTag("experience-recommend-${recommendation.wireValue}")
                        .selectable(selected, role = Role.RadioButton) {
                            draft = draft.copy(recommendation = recommendation)
                        },
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            PilotInput(
                label = "Public experience",
                value = draft.feedback,
                tag = "experience-feedback",
                enabled = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                singleLine = false,
                maxLines = 6,
                modifier = Modifier.heightIn(min = 112.dp),
            ) { draft = draft.copy(feedback = it) }
            PilotText("Optional. This becomes public when the other member also shares an experience.")
        }
        state.error?.let { PilotError(it) }
        PilotButton(
            label = if (state.isSaving) "Sharing…" else "Share",
            enabled = draft.hasInteraction && !state.isSaving,
            primary = true,
            modifier = Modifier.fillMaxWidth().testTag("experience-share"),
        ) {
            focusManager.clearFocus()
            onSubmit(draft)
        }
    }
}

@Composable
private fun ExperienceInteraction(label: String, tag: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    ExperienceChoice(
        label,
        checked,
        Modifier.testTag(tag).toggleable(checked, role = Role.Checkbox, onValueChange = onChange),
    )
}

@Composable
private fun ExperienceChoice(label: String, selected: Boolean, modifier: Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        modifier = Modifier.fillMaxWidth().clip(shape).heightIn(min = 48.dp)
            .background(if (selected) pilotPalette.surface else pilotPalette.background)
            .then(modifier)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PilotText(label, Modifier.weight(1f), strong = selected)
        if (selected) PilotText("✓", colour = pilotPalette.accent, modifier = Modifier.clearAndSetSemantics {})
    }
}
