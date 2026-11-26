package org.trustroots.android.api

import java.net.URI
import java.net.URISyntaxException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import org.json.JSONObject

internal const val BROWSER_SIGN_IN_CALLBACK_HOST = "www.trustroots.org"
private const val CALLBACK_PATH = "/mobile-auth/complete"
internal const val BROWSER_SIGN_IN_CALLBACK_URL = "https://$BROWSER_SIGN_IN_CALLBACK_HOST$CALLBACK_PATH"
private val handoffToken = Regex("[A-Za-z0-9_-]{43}")
private val random = SecureRandom()

internal class BrowserSignInCallback(val code: String, val state: String) {
    companion object {
        fun parse(url: String): BrowserSignInCallback? {
            val uri = try {
                URI(url)
            } catch (_: URISyntaxException) {
                return null
            }
            if (
                uri.scheme != "https" || uri.rawAuthority != BROWSER_SIGN_IN_CALLBACK_HOST ||
                uri.rawPath != CALLBACK_PATH || uri.rawFragment != null
            ) return null
            val parameters = uri.rawQuery?.split('&') ?: return null
            if (parameters.size != 2) return null
            val code = parameters.singleOrNull { it.startsWith("code=") }?.substringAfter('=') ?: return null
            val state = parameters.singleOrNull { it.startsWith("state=") }?.substringAfter('=') ?: return null
            if (!handoffToken.matches(code) || !handoffToken.matches(state)) return null
            return BrowserSignInCallback(code, state)
        }
    }
}

internal class BrowserSignInAttempt(
    val backendURL: String,
    val codeVerifier: String,
    val state: String,
    val expiresAtMillis: Long,
) {
    fun startURL(): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(codeVerifier.toByteArray(Charsets.US_ASCII))
        val codeChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
        return "$backendURL/auth/mobile/start?platform=android&code_challenge=$codeChallenge&state=$state"
    }

    fun toJSON(): JSONObject = JSONObject()
        .put("backendURL", backendURL)
        .put("codeVerifier", codeVerifier)
        .put("state", state)
        .put("expiresAtMillis", expiresAtMillis)

    companion object {
        fun create(backendURL: String, nowMillis: Long = System.currentTimeMillis()) = BrowserSignInAttempt(
            secureApiBaseURL(backendURL),
            newToken(),
            newToken(),
            nowMillis + 5 * 60_000L,
        )

        fun fromJSON(payload: JSONObject) = BrowserSignInAttempt(
            payload.getString("backendURL"),
            payload.getString("codeVerifier"),
            payload.getString("state"),
            payload.getLong("expiresAtMillis"),
        )

        private fun newToken(): String = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(ByteArray(32).also(random::nextBytes))
    }
}
