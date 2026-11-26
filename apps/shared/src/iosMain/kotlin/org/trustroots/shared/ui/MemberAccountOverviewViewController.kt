package org.trustroots.shared.ui

fun MemberAccountOverviewViewController(
    section: MemberAccountOverviewSection,
    position: AccountSectionPosition,
    onAction: () -> Unit,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController(section.tag, position, onHeight, opaque = false) { modifier ->
    MemberAccountOverview(section, onAction, modifier)
}
