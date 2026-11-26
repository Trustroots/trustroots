package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

class MemberAccountPreferencesState {
    internal var content by mutableStateOf(MemberAccountPreferencesContent())
        private set
    internal var origin by mutableStateOf(Offset.Zero)
        private set

    fun updateOrigin(x: Double, y: Double) {
        origin = Offset(x.toFloat(), y.toFloat())
    }

    fun update(
        email: String,
        newsletter: Boolean,
        canCorrectSignupEmail: Boolean,
        pendingEmail: String?,
        canCancelEmailChange: Boolean,
        isSaving: Boolean,
        confirmation: String?,
        error: String?,
    ) {
        content = MemberAccountPreferencesContent(
            email, newsletter, canCorrectSignupEmail, pendingEmail, canCancelEmailChange, isSaving, confirmation, error,
        )
    }

    internal fun editEmail(email: String) {
        content = content.copy(email = email)
    }

    internal fun editNewsletter(newsletter: Boolean) {
        content = content.copy(newsletter = newsletter)
    }
}

internal data class MemberAccountPreferencesContent(
    val email: String = "",
    val newsletter: Boolean = false,
    val canCorrectSignupEmail: Boolean = false,
    val pendingEmail: String? = null,
    val canCancelEmailChange: Boolean = false,
    val isSaving: Boolean = false,
    val confirmation: String? = null,
    val error: String? = null,
)

@Composable
internal fun MemberAccountPreferences(
    state: MemberAccountPreferencesState,
    emailKeyboard: KeyboardOptions,
    onEmail: (String) -> Unit,
    onNewsletter: (Boolean) -> Unit,
    onSave: () -> Unit,
    onChangeEmail: () -> Unit,
    onCancelEmailChange: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val content = state.content
    val focus = LocalFocusManager.current
    Column(
        modifier.background(pilotPalette.surface, RoundedCornerShape(18.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PilotTitle("Email")
        if (content.canCorrectSignupEmail) {
            PilotInput(
                label = "Email address",
                value = content.email,
                tag = "account-email",
                enabled = !content.isSaving,
                keyboardOptions = emailKeyboard,
                keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
            ) { email ->
                state.editEmail(email)
                onEmail(email)
            }
        } else {
            if (content.email.isNotBlank()) {
                PilotText(content.email, Modifier.testTag("account-current-email"))
            }
            PilotButton(
                "Change email",
                enabled = !content.isSaving,
                modifier = Modifier.fillMaxWidth().testTag("account-change-email"),
                onClick = onChangeEmail,
            )
        }
        content.pendingEmail?.let { PilotText("Email confirmation is pending for $it.") }
        if (content.canCancelEmailChange) {
            PilotButton(
                "Cancel pending email change",
                enabled = !content.isSaving,
                modifier = Modifier.fillMaxWidth().testTag("account-cancel-email-change"),
                onClick = onCancelEmailChange,
            )
        }
        NewsletterSwitch(content.newsletter, enabled = !content.isSaving) { subscribed ->
            state.editNewsletter(subscribed)
            onNewsletter(subscribed)
        }
        PilotButton(
            if (content.isSaving) "Saving…" else "Save",
            enabled = !content.isSaving && (!content.canCorrectSignupEmail || content.email.isNotBlank()),
            primary = true,
            modifier = Modifier.fillMaxWidth().testTag("account-save-preferences"),
        ) {
            focus.clearFocus()
            onSave()
        }
        content.confirmation?.let {
            PilotText(it, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
        content.error?.let { PilotError(it) }
    }
}

@Composable
private fun NewsletterSwitch(subscribed: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    val palette = pilotPalette
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
            .toggleable(value = subscribed, enabled = enabled, role = Role.Switch, onValueChange = onChange)
            .testTag("account-newsletter"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PilotText("Community newsletter", Modifier.weight(1f))
        Box(
            Modifier.size(width = 46.dp, height = 26.dp)
                .background(if (subscribed) palette.accent else palette.border, CircleShape)
                .padding(3.dp),
            contentAlignment = if (subscribed) Alignment.CenterEnd else Alignment.CenterStart,
        ) {
            Box(Modifier.size(20.dp).background(palette.background, CircleShape))
        }
    }
}
