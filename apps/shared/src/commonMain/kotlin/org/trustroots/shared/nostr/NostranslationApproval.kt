package org.trustroots.shared.nostr

private val hex32 = Regex("[0-9a-f]{64}")
private const val AUTHORISATION_KIND = 27235
private const val WINDOW_SECONDS = 60L
private const val MAX_EVENT_TIME = 9007199254740991L
private const val REVIEW_DESTINATION = "https://nostranslation-api.trustroots.org/api/reviews"

private fun inAuthorisationWindow(createdAt: Long, now: Long): Boolean =
    now in 1..MAX_EVENT_TIME &&
        createdAt in (now - WINDOW_SECONDS)..(now + WINDOW_SECONDS) &&
        createdAt in 1..MAX_EVENT_TIME

/**
 * The native adapter constructs this from a user-approved client and its stored
 * account key. It owns durable revocation and must revoke this pairing before
 * deleting or replacing a key. It must verify the NIP-46 envelope and recipient before passing
 * its authenticated sender here. Do not pass data claimed by the decrypted RPC
 * body as a peer key.
 */
class NostranslationPairing(
    private val account: NostrAccountScope,
    private val clientPublicKey: String,
    private val signingPublicKey: String,
) {
    init {
        require(hex32.matches(clientPublicKey) && hex32.matches(signingPublicKey))
    }

    var isRevoked: Boolean = false
        private set

    fun revoke() { isRevoked = true }

    internal fun matches(session: NostrSigningSession, localPublicKey: String): Boolean =
        !isRevoked && session.scope?.storageAccount == account.storageAccount &&
            signingPublicKey == localPublicKey

    fun prepareReview(
        session: NostrSigningSession,
        authenticatedPeer: String,
        localPublicKey: String,
        kind: Int,
        createdAt: Long,
        content: String,
        tags: List<List<String>>,
        now: Long,
    ): NostranslationApproval? {
        if (authenticatedPeer != clientPublicKey || !matches(session, localPublicKey)) return null
        if (kind != AUTHORISATION_KIND || content.isNotEmpty() || !inAuthorisationWindow(createdAt, now)) return null
        if (tags.size != 3 || tags.any { it.size != 2 }) return null
        val orderedTags = tags.map { it.toList() }
        val values = orderedTags.associate { it[0] to it[1] }
        if (values["u"] != REVIEW_DESTINATION || values["method"] != "POST") return null
        val payload = values["payload"]?.takeIf(hex32::matches) ?: return null

        return NostranslationApproval(
            pairing = this,
            session = session,
            revision = session.revision,
            event = NostranslationReviewEvent(createdAt, orderedTags, payload, signingPublicKey),
        )
    }
}

/** Main-thread policy token. Pass the returned event straight to the native signer. */
class NostranslationApproval internal constructor(
    private val pairing: NostranslationPairing,
    private val session: NostrSigningSession,
    private val revision: Long,
    private val event: NostranslationReviewEvent,
) {
    val destination: String get() = event.destination
    val expiresAt: Long get() = event.createdAt + WINDOW_SECONDS
    private var resolved = false

    /** Use only from the member's explicit approval action, with current time and key. */
    fun approve(now: Long, localPublicKey: String): NostranslationReviewEvent? {
        if (resolved) return null
        resolved = true
        return event.takeIf {
            session.isCurrent(revision) && pairing.matches(session, localPublicKey) &&
                inAuthorisationWindow(it.createdAt, now)
        }
    }

    fun deny() { resolved = true }
}

class NostranslationReviewEvent internal constructor(
    val createdAt: Long,
    tags: List<List<String>>,
    val payloadDigest: String,
    val signingPublicKey: String,
) {
    val kind: Int get() = AUTHORISATION_KIND
    val content: String get() = ""
    val destination: String get() = REVIEW_DESTINATION
    private val orderedTags = tags.map { it.toList() }
    val tags: List<List<String>> get() = orderedTags.map { it.toList() }
}
