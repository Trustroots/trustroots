package org.trustroots.android.api

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.IOException
import java.net.HttpURLConnection
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

class SecureMobileSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    internal val renewedSession = latestRenewal.asStateFlow()

    fun save(session: MemberSession) = synchronized(storageLock) {
        writeSession(session, durable = false)
        latestRenewal.value = null
    }

    private fun writeSession(session: MemberSession, durable: Boolean) {
        val payload = JSONObject()
            .put("cookieHeader", session.cookieHeader)
            .put("accessToken", session.accessToken)
            .put("refreshToken", session.refreshToken)
            .put("localSessionId", session.localSessionId?.toString())
            .put("username", session.member.username)
            .put("displayName", session.member.displayName)
            .toString()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(payload.toByteArray(StandardCharsets.UTF_8))
        val editor = preferences.edit()
            .putString(PAYLOAD_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(IV_KEY, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
        if (durable) {
            if (!editor.commit()) throw IOException("Could not persist the renewed session")
        } else {
            editor.apply()
        }
    }

    fun load(): MemberSession? = synchronized(storageLock) { readSession() }

    private fun readSession(): MemberSession? = runCatching {
        val payload = preferences.getString(PAYLOAD_KEY, null) ?: return null
        val iv = preferences.getString(IV_KEY, null) ?: return null
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            secretKey(),
            GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)),
        )
        val decoded = cipher.doFinal(Base64.decode(payload, Base64.NO_WRAP))
        val session = JSONObject(String(decoded, StandardCharsets.UTF_8))
        MemberSession(
            cookieHeader = session.getString("cookieHeader"),
            accessToken = session.optString("accessToken").takeIf(String::isNotBlank),
            refreshToken = session.optString("refreshToken").takeIf(String::isNotBlank),
            localSessionId = session.optString("localSessionId").takeIf(String::isNotBlank)?.let(UUID::fromString),
            member = MobileMember(
                username = session.getString("username"),
                displayName = session.getString("displayName"),
            ),
        )
    }.getOrNull()

    fun clear() = synchronized(storageLock) {
        preferences.edit().clear().apply()
        latestRenewal.value = null
    }

    internal fun updateMember(session: MemberSession): Unit = synchronized(storageLock) {
        val stored = readSession()
        if (stored != null && stored.sessionId == session.sessionId && stored.cookieHeader == session.cookieHeader) {
            writeSession(stored.copy(member = session.member), durable = false)
        }
    }

    internal fun currentBearerSession(session: MemberSession): MemberSession =
        load()?.takeIf { it.sessionId == session.sessionId }
            ?: throw MobileApiException(HttpURLConnection.HTTP_UNAUTHORIZED)

    internal fun rotateBearerSession(
        rejected: MemberSession,
        refresh: (MemberSession) -> MemberSession,
    ): MemberSession = synchronized(rotationLock) {
        val current = currentBearerSession(rejected)
        if (current.accessToken != rejected.accessToken) return@synchronized current
        val refreshed = refresh(current)
        synchronized(storageLock) {
            val stored = currentBearerSession(current)
            val updated = if (stored.member == current.member) refreshed else refreshed.copy(member = stored.member)
            writeSession(updated, durable = true)
            latestRenewal.value = updated
            updated
        }
    }

    internal fun clearIfCurrent(session: MemberSession): Unit = synchronized(storageLock) {
        if (readSession()?.accessToken == session.accessToken) clear()
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE).run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        val storageLock = Any()
        // Serialise server rotations across startup, the member shell and push registration.
        val rotationLock = Any()
        val latestRenewal = MutableStateFlow<MemberSession?>(null)
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val KEY_ALIAS = "org.trustroots.android.mobile-session"
        const val PREFERENCES_NAME = "mobile-session"
        const val PAYLOAD_KEY = "payload"
        const val IV_KEY = "iv"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
