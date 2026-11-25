package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** The iOS host owns the secure input and exposes only the action state. */
class MemberAccountPasswordActionsState {
    internal var content by mutableStateOf(MemberAccountPasswordActionsContent())
        private set

    fun update(canSubmit: Boolean, isChanging: Boolean, confirmation: String?, error: String?) {
        content = MemberAccountPasswordActionsContent(canSubmit, isChanging, confirmation, error)
    }
}

internal data class MemberAccountPasswordActionsContent(
    val canSubmit: Boolean = false,
    val isChanging: Boolean = false,
    val confirmation: String? = null,
    val error: String? = null,
)

@Composable
internal fun MemberAccountPasswordActions(
    state: MemberAccountPasswordActionsState,
    onChangePassword: () -> Unit,
    onRecoverPassword: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val content = state.content
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PilotButton(
            if (content.isChanging) "Changing password…" else "Change password",
            enabled = content.canSubmit && !content.isChanging,
            primary = true,
            modifier = Modifier.fillMaxWidth().testTag("account-change-password"),
            onClick = onChangePassword,
        )
        PilotButton(
            "Forgot your password?",
            modifier = Modifier.testTag("account-password-recovery"),
            onClick = onRecoverPassword,
        )
        content.confirmation?.let {
            PilotText(it, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
        content.error?.let { PilotError(it) }
    }
}
