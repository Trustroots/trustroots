package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp

data class MemberProfileDraft(
    val displayName: String,
    val tagline: String,
    val locationLiving: String,
    val locationFrom: String,
    val biography: String,
)

class MemberProfileEditorState {
    internal var content by mutableStateOf(MemberProfileEditorContent())
        private set

    fun update(draft: MemberProfileDraft, languages: String?, isSaving: Boolean, error: String?) {
        content = MemberProfileEditorContent(draft, languages, isSaving, error)
    }

    internal fun edit(draft: MemberProfileDraft) {
        content = content.copy(draft = draft)
    }
}

internal data class MemberProfileEditorContent(
    val draft: MemberProfileDraft = MemberProfileDraft("", "", "", "", ""),
    val languages: String? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
)

@Composable
internal fun MemberProfileEditor(
    state: MemberProfileEditorState,
    onEdit: (MemberProfileDraft) -> Unit,
    onChooseLanguages: () -> Unit,
    onSave: () -> Unit,
) {
    val content = state.content
    val draft = content.draft
    val focus = LocalFocusManager.current

    fun applyEdit(draft: MemberProfileDraft) {
        state.edit(draft)
        onEdit(draft)
    }

    Box(
        Modifier.fillMaxSize().background(pilotPalette.background).imePadding().padding(horizontal = 16.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(Modifier.widthIn(max = 600.dp).fillMaxWidth().testTag("profile-editor")) {
            PilotForm(spacing = 18.dp) {
                PilotTitle("Edit profile")
                PilotInput("Name", draft.displayName, "profile-editor-name", enabled = true) {
                    applyEdit(state.content.draft.copy(displayName = it))
                }
                PilotInput("Tagline", draft.tagline, "profile-editor-tagline", enabled = true) {
                    applyEdit(state.content.draft.copy(tagline = it))
                }
                PilotInput("Lives in", draft.locationLiving, "profile-editor-living", enabled = true) {
                    applyEdit(state.content.draft.copy(locationLiving = it))
                }
                PilotInput("From", draft.locationFrom, "profile-editor-origin", enabled = true) {
                    applyEdit(state.content.draft.copy(locationFrom = it))
                }
                Column {
                    PilotText("Languages", Modifier.padding(bottom = 4.dp), strong = true)
                    PilotButton(
                        content.languages ?: "Choose languages",
                        modifier = Modifier.fillMaxWidth().testTag("profile-editor-languages"),
                    ) {
                        focus.clearFocus()
                        onChooseLanguages()
                    }
                }
                PilotInput(
                    label = "About me",
                    value = draft.biography,
                    tag = "profile-editor-biography",
                    enabled = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    singleLine = false,
                    minLines = 15,
                ) {
                    applyEdit(state.content.draft.copy(biography = it))
                }
                content.error?.let { PilotError(it) }
                PilotButton(
                    if (content.isSaving) "Saving…" else "Save profile",
                    enabled = !content.isSaving && draft.displayName.isNotBlank(),
                    primary = true,
                    modifier = Modifier.fillMaxWidth().testTag("profile-editor-save"),
                ) {
                    focus.clearFocus()
                    onSave()
                }
            }
        }
    }
}
