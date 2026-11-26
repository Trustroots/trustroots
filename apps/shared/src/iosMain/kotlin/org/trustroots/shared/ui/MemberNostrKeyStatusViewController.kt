package org.trustroots.shared.ui

fun MemberNostrProfileKeyStatusViewController(
    profileLoaded: Boolean,
    hasLinkedKey: Boolean,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("nostr-profile-key-status", onHeight, opaque = false) { modifier ->
    MemberNostrProfileKeyStatus(profileLoaded, hasLinkedKey, modifier)
}

fun MemberNostrLocalKeyStatusViewController(
    hasLocalKey: Boolean,
    onHeight: (Double) -> Unit,
) = AccountSectionViewController("nostr-local-key-status", onHeight, opaque = false) { modifier ->
    MemberNostrLocalKeyStatus(hasLocalKey, modifier)
}
