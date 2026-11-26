package org.trustroots.shared.ui

fun MemberAccountPasswordActionsViewController(
    state: MemberAccountPasswordActionsState,
    position: AccountSectionPosition,
    onChangePassword: () -> Unit,
    onRecoverPassword: () -> Unit,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("account-password-actions", position, onHeight) { modifier ->
    MemberAccountPasswordActions(state, onChangePassword, onRecoverPassword, modifier)
}
