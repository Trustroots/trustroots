package org.trustroots.shared.ui

fun MemberAccountPasswordActionsViewController(
    state: MemberAccountPasswordActionsState,
    onChangePassword: () -> Unit,
    onRecoverPassword: () -> Unit,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("account-password-actions", onHeight) { modifier ->
    MemberAccountPasswordActions(state, onChangePassword, onRecoverPassword, modifier)
}
