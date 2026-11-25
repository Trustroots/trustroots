package org.trustroots.shared.ui

import androidx.compose.ui.window.ComposeUIViewController

fun MemberProfileEditorViewController(
    state: MemberProfileEditorState,
    onEdit: (MemberProfileDraft) -> Unit,
    onChooseLanguages: () -> Unit,
    onSave: () -> Unit,
) = ComposeUIViewController {
    MemberProfileEditor(state, onEdit, onChooseLanguages, onSave)
}
