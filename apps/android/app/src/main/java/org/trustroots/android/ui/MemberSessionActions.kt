package org.trustroots.android.ui

import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember

internal fun updatePersistedMember(
    session: MemberSession?,
    member: MobileMember,
    save: (MemberSession) -> Unit,
): MemberSession? {
    val current = session ?: return null
    val updated = current.copy(member = member)
    save(updated)
    return updated
}

internal fun clearPersistedSession(
    session: MemberSession?,
    apiBaseUrl: String,
    clearCache: (server: String, account: String) -> Unit,
    clearSession: () -> Unit,
) {
    session?.let { clearCache(apiBaseUrl.trim().trimEnd('/'), it.member.username) }
    clearSession()
}
