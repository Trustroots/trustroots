package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.mutableStateOf
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

class AccountSectionPosition {
    private val position = mutableStateOf(Offset.Zero)
    internal val origin: Offset get() = position.value

    fun updateOrigin(x: Double, y: Double) {
        position.value = Offset(x.toFloat(), y.toFloat())
    }
}

private val AccountSectionOrigin = SemanticsPropertyKey<Offset>("AccountSectionOrigin")

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun MemberAccountPreferencesViewController(
    state: MemberAccountPreferencesState,
    position: AccountSectionPosition,
    onEmail: (String) -> Unit,
    onNewsletter: (Boolean) -> Unit,
    onSave: () -> Unit,
    onHeight: (Double) -> Unit,
) = ComposeUIViewController {
    val density = LocalDensity.current
    Box(Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true)) {
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
            modifier = Modifier.fillMaxWidth().testTag("account-preferences")
                // The enclosing SwiftUI scroll view moves this host without relaying layout to Compose.
                .semantics { this[AccountSectionOrigin] = position.origin }
                .onSizeChanged { onHeight(with(density) { it.height.toDp().value.toDouble() }) },
        )
    }
}
