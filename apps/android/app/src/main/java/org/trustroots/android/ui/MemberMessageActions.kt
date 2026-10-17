package org.trustroots.android.ui

internal fun sendMessageIfReady(
    memberID: String?,
    content: String,
    sending: Boolean,
    onSend: (String, String) -> Unit,
) {
    val id = memberID ?: return
    if (content.trim().isBlank() || sending) return
    onSend(id, content)
}
