package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

enum class MemberAccountOverviewSection(internal val label: String, internal val tag: String) {
    Heading("Account", "account-overview-heading"),
    Signing("Nostranslation signing", "account-nostranslation-signing"),
    SignOut("Sign out", "account-sign-out"),
}

@Composable
internal fun MemberAccountOverview(
    section: MemberAccountOverviewSection,
    onAction: () -> Unit,
    modifier: Modifier,
) {
    when (section) {
        MemberAccountOverviewSection.Heading -> Box(modifier) { PilotTitle(section.label) }
        MemberAccountOverviewSection.Signing,
        MemberAccountOverviewSection.SignOut,
        -> PilotButton(
            label = section.label,
            modifier = modifier,
            destructive = section == MemberAccountOverviewSection.SignOut,
            onClick = onAction,
        )
    }
}
