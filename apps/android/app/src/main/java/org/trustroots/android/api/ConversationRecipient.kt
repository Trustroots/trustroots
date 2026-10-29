package org.trustroots.android.api

/** The resolved mini-user record, whose canonical ID has passed API validation. */
data class ConversationRecipient(
    val id: String,
    val username: String?,
    val displayName: String,
)
