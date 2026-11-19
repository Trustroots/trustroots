package org.trustroots.android.nostr

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.trustroots.shared.nostr.NostrAccountScope

internal fun nostrAccountScope(backend: String, username: String): NostrAccountScope {
    val url = URL(backend)
    val port = url.port.takeIf { it >= 0 && it != url.defaultPort }
    val origin = "${url.protocol}://${url.host}" + (port?.let { ":$it" } ?: "")
    return NostrAccountScope(origin, username)
}

internal class AndroidNostrKeys(context: Context, scope: NostrAccountScope) {
    private val preferences = context.applicationContext.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
    private val account = scope.storageAccount
    private val associatedData = account.encodeToByteArray()

    fun publicKey(): String? = withKey(NostrKeyCodec::npub)
    fun backup(): String? = withKey(NostrKeyCodec::nsec)

    fun generate(): String = insert(NostrKeyCodec.generate())
    fun import(input: String): String = insert(NostrKeyCodec.import(input))

    fun remove() = synchronized(lock) {
        check(preferences.edit().remove(account).commit())
    }

    private fun insert(secret: ByteArray): String = try {
        synchronized(lock) {
            check(!preferences.contains(account))
            val npub = NostrKeyCodec.npub(secret)
            val cipher = Cipher.getInstance(transformation)
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey(create = true))
            cipher.updateAAD(associatedData)
            val record = cipher.iv + cipher.doFinal(secret)
            check(preferences.edit().putString(account, Base64.encodeToString(record, Base64.NO_WRAP)).commit())
            npub
        }
    } finally {
        secret.fill(0)
    }

    private fun <T> withKey(use: (ByteArray) -> T): T? = synchronized(lock) {
        val encoded = preferences.getString(account, null) ?: return null
        val record = Base64.decode(encoded, Base64.NO_WRAP)
        val cipher = Cipher.getInstance(transformation)
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(create = false), GCMParameterSpec(128, record, 0, 12))
        cipher.updateAAD(associatedData)
        val secret = cipher.doFinal(record, 12, record.size - 12)
        try {
            use(secret)
        } finally {
            secret.fill(0)
        }
    }

    private fun encryptionKey(create: Boolean): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        check(create)
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(
                KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        val lock = Any()
        const val alias = "org.trustroots.android.nostr-identities"
        const val transformation = "AES/GCM/NoPadding"
    }
}
