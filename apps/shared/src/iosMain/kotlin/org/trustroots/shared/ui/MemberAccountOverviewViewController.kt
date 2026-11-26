package org.trustroots.shared.ui

fun MemberAccountOverviewViewController(
    section: MemberAccountOverviewSection,
    onAction: () -> Unit,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController(section.tag, onHeight, opaque = false) { modifier ->
    MemberAccountOverview(section, onAction, modifier)
}
