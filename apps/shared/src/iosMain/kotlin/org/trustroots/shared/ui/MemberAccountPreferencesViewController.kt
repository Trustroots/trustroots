package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PlatformImeOptions
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UITextContentTypeEmailAddress

private val AccountPreferencesOrigin = SemanticsPropertyKey<Offset>("AccountPreferencesOrigin")

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun MemberAccountPreferencesViewController(
    state: MemberAccountPreferencesState,
    onEmail: (String) -> Unit,
    onNewsletter: (Boolean) -> Unit,
    onSave: () -> Unit,
    onChangeEmail: () -> Unit,
    onCancelEmailChange: () -> Unit,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("account-preferences", onHeight) { modifier ->
    MemberAccountPreferences(
        state,
        emailKeyboard = KeyboardOptions(
            capitalization = KeyboardCapitalization.None,
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Done,
            autoCorrectEnabled = false,
            platformImeOptions = PlatformImeOptions { textContentType(UITextContentTypeEmailAddress) },
        ),
        onEmail = onEmail,
        onNewsletter = onNewsletter,
        onSave = onSave,
        onChangeEmail = onChangeEmail,
        onCancelEmailChange = onCancelEmailChange,
        // The native scroll view moves this host without changing its Compose layout.
        modifier = modifier.semantics { this[AccountPreferencesOrigin] = state.origin },
    )
}

@OptIn(ExperimentalComposeUiApi::class)
internal fun AccountSectionViewController(
    accessibilityTag: String,
    onHeight: (Double) -> Unit,
    opaque: Boolean = true,
    content: @Composable (Modifier) -> Unit,
) = ComposeUIViewController(configure = { this.opaque = opaque }) {
    val density = LocalDensity.current
    Box(Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true)) {
        content(
            Modifier.fillMaxWidth().testTag(accessibilityTag)
                .onSizeChanged { onHeight(with(density) { it.height.toDp().value.toDouble() }) },
        )
    }
}
