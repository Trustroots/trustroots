package org.trustroots.shared.nostr

/**
 * No secrets or platform storage. Native URL parsers supply a non-empty API origin
 * with default ports removed; paths, credentials, queries and fragments are not origins.
 */
class NostrAccountScope(serverOrigin: String, username: String) {
    val serverOrigin: String = serverOrigin.trim().trimEnd('/').lowercase()
    val username: String = username.trim().lowercase()

    // Length prefixes prevent delimiter collisions and version future storage migrations.
    val storageAccount: String = "nostr-v1:${this.serverOrigin.length}:${this.serverOrigin}:${this.username.length}:${this.username}"
}

/** Main-thread confined by each native host. Revisions invalidate work across A → B → A. */
class NostrSigningSession {
    var scope: NostrAccountScope? = null
        private set
    var revision: Long = 0
        private set

    fun activate(account: NostrAccountScope): Boolean {
        if (scope?.storageAccount == account.storageAccount) return false
        scope = account
        invalidate()
        return true
    }

    fun pause() {
        scope = null
        invalidate()
    }

    /** Call after key removal/replacement so an earlier approval cannot use a later key. */
    fun invalidate() {
        revision += 1
    }

    fun isCurrent(capturedRevision: Long): Boolean =
        scope != null && capturedRevision == revision
}
