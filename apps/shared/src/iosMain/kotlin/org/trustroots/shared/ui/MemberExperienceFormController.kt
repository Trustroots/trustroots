package org.trustroots.shared.ui

import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIViewController

@OptIn(ExperimentalForeignApi::class)
fun MemberExperienceFormViewController(
    state: MemberExperienceFormState,
    onSubmit: (MemberExperienceDraft) -> Unit,
): UIViewController = ComposeUIViewController {
    MemberExperienceForm(state, onSubmit)
}
