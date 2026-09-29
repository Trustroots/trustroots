package org.trustroots.android.api

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/** Encrypted, account and server scoped snapshots of a small set of read responses. */
class SecureResponseCache(context: Context) {
    private val root = File(context.noBackupFilesDir, "response-cache")

    data class Snapshot(val body: String, val savedAt: Long)

    fun save(server: String, account: String, path: String, body: String) {
        val policy = cachePolicy(path, account) ?: return
        if (body.toByteArray().size > 512 * 1024) return
        runCatching {
            val directory = scopeDirectory(server, account)
            directory.mkdirs()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey())
            val payload = JSONObject().put("savedAt", System.currentTimeMillis()).put("body", body).toString()
            val encrypted = cipher.doFinal(payload.toByteArray(Charsets.UTF_8))
            val file = File(directory, "${policy.first}-${digest(path)}")
            val temporary = File.createTempFile("snapshot-", ".tmp", directory)
            temporary.outputStream().use { it.write(cipher.iv + encrypted) }
            if (!temporary.renameTo(file)) {
                file.delete()
                temporary.renameTo(file)
            }
            directory.listFiles { item -> item.name.startsWith("${policy.first}-") }
                ?.sortedByDescending(File::lastModified)
                ?.drop(policy.second)
                ?.forEach(File::delete)
        }
    }

    fun load(server: String, account: String, path: String): Snapshot? {
        val policy = cachePolicy(path, account) ?: return null
        return runCatching {
            val bytes = File(scopeDirectory(server, account), "${policy.first}-${digest(path)}").readBytes()
            if (bytes.size <= 12) return null
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            val payload = JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
            Snapshot(payload.getString("body"), payload.getLong("savedAt"))
        }.getOrNull()
    }

    fun clear(server: String, account: String) {
        scopeDirectory(server, account).deleteRecursively()
    }

    fun clearCategories(server: String, account: String, categories: Set<String>) {
        scopeDirectory(server, account).listFiles()?.forEach { file ->
            if (categories.any { file.name.startsWith("$it-") }) file.delete()
        }
    }

    private fun scopeDirectory(server: String, account: String) =
        File(root, digest("$server|${account.lowercase()}"))

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            generateKey()
        }
    }

    private fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    private companion object {
        const val KEY_ALIAS = "org.trustroots.android.response-cache"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

internal fun cachePolicy(path: String, account: String): Pair<String, Int>? = when {
    path.startsWith("/api/offers?") -> "map" to 4
    path.startsWith("/api/offers/") -> "offer" to 6
    path.matches(Regex("/api/messages\\?page=[1-3]&limit=50")) -> "inbox" to 3
    path.startsWith("/api/messages/") && path.endsWith("?limit=100") -> "thread" to 12
    path == "/api/users/$account" -> "own-profile" to 1
    path.startsWith("/api/users/") && path.count { it == '/' } == 3 &&
        !path.contains('?') -> "profile" to 8
    path.startsWith("/api/contacts/") || path.startsWith("/api/experiences?userTo=") ||
        path.startsWith("/api/offers-by/") -> "profile-detail" to 24
    else -> null
}
