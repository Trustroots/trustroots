package org.trustroots.shared.ui

fun MemberNostrProfileKeyStatusViewController(
    profileLoaded: Boolean,
    hasLinkedKey: Boolean,
    position: AccountSectionPosition,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("nostr-profile-key-status", position, onHeight, opaque = false) { modifier ->
    MemberNostrProfileKeyStatus(profileLoaded, hasLinkedKey, modifier)
}

fun MemberNostrLocalKeyStatusViewController(
    hasLocalKey: Boolean,
    position: AccountSectionPosition,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("nostr-local-key-status", position, onHeight, opaque = false) { modifier ->
    MemberNostrLocalKeyStatus(hasLocalKey, modifier)
}
