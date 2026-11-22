package org.trustroots.android.nostr

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.net.URL
import java.security.KeyStore
import java.util.concurrent.atomic.AtomicLong
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.trustroots.shared.nostr.NostrAccountScope
import org.json.JSONObject

internal fun nostrAccountScope(backend: String, username: String): NostrAccountScope {
    val url = URL(backend)
    val port = url.port.takeIf { it >= 0 && it != url.defaultPort }
    val origin = "${url.protocol}://${url.host}" + (port?.let { ":$it" } ?: "")
    return NostrAccountScope(origin, username)
}

internal class AndroidNostrKeys(
    context: Context,
    scope: NostrAccountScope,
    private val keyAlias: String = "org.trustroots.android.nostr-identities",
) {
    private val preferences = context.applicationContext.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
    private val account = scope.storageAccount
    private val pairingAccount = "nostranslation:$account"

    fun publicKey(): String? = withKey(use = NostrKeyCodec::npub)
    fun browserPublicKey(revision: Long): String? = withKey(revision, NostrEventSigner::publicKey)
    fun signBrowserEvent(event: JSONObject, revision: Long): JSONObject? =
        withKey(revision) { NostrEventSigner.sign(event, it) }
    fun revision(): Long = keyRevision.get()

    fun backup(): String? = withKey(use = NostrKeyCodec::nsec)

    fun signProfileChallenge(event: JSONObject, backend: String, expectedNpub: String): JSONObject =
        checkNotNull(withKey { secret ->
            check(NostrKeyCodec.npub(secret) == expectedNpub)
            NostrProfileProof.sign(event, backend, secret)
        })

    fun generate(): String = insert(NostrKeyCodec.generate())
    fun import(input: String): String = insert(NostrKeyCodec.import(input))

    fun remove() = synchronized(lock) {
        check(preferences.edit().remove(account).remove(pairingAccount).commit())
        keyRevision.incrementAndGet()
        Unit
    }

    fun loadPairings(revision: Long): JSONArray = synchronized(lock) {
        check(revision == keyRevision.get() && preferences.contains(account))
        val bytes = readEncrypted(pairingAccount) ?: return JSONArray()
        try {
            JSONArray(bytes.decodeToString())
        } finally {
            bytes.fill(0)
        }
    }

    fun savePairings(revision: Long, pairings: JSONArray) = synchronized(lock) {
        check(revision == keyRevision.get() && preferences.contains(account))
        val bytes = pairings.toString().encodeToByteArray()
        try {
            writeEncrypted(pairingAccount, bytes)
        } finally {
            bytes.fill(0)
        }
    }

    private fun insert(secret: ByteArray): String = try {
        synchronized(lock) {
            check(!preferences.contains(account))
            val npub = NostrKeyCodec.npub(secret)
            writeEncrypted(account, secret)
            keyRevision.incrementAndGet()
            npub
        }
    } finally {
        secret.fill(0)
    }

    private fun <T> withKey(expectedRevision: Long? = null, use: (ByteArray) -> T): T? = synchronized(lock) {
        if (expectedRevision != null && expectedRevision != keyRevision.get()) return null
        val secret = readEncrypted(account) ?: return null
        try {
            use(secret)
        } finally {
            secret.fill(0)
        }
    }

    private fun writeEncrypted(storageAccount: String, bytes: ByteArray) {
        val cipher = Cipher.getInstance(transformation)
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey(create = true))
        cipher.updateAAD(storageAccount.encodeToByteArray())
        val record = cipher.iv + cipher.doFinal(bytes)
        check(preferences.edit().putString(storageAccount, Base64.encodeToString(record, Base64.NO_WRAP)).commit())
    }

    private fun readEncrypted(storageAccount: String): ByteArray? {
        val encoded = preferences.getString(storageAccount, null) ?: return null
        val record = Base64.decode(encoded, Base64.NO_WRAP)
        val cipher = Cipher.getInstance(transformation)
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(create = false), GCMParameterSpec(128, record, 0, 12))
        cipher.updateAAD(storageAccount.encodeToByteArray())
        return cipher.doFinal(record, 12, record.size - 12)
    }

    private fun encryptionKey(create: Boolean): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        check(create)
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(
                KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        val lock = Any()
        val keyRevision = AtomicLong()
        const val transformation = "AES/GCM/NoPadding"
    }
}
