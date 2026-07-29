package org.trustroots.android.api

import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class MobileMember(
    val username: String,
    val displayName: String,
)

data class MemberSession(
    val cookieHeader: String,
    val member: MobileMember,
)

class MobileApiException(
    val statusCode: Int,
    override val message: String,
) : Exception(message) {
    val isAuthenticationFailure: Boolean
        get() = statusCode == HttpURLConnection.HTTP_UNAUTHORIZED
}

class MobileApiClient(baseURL: String) {
    private val baseURL = secureApiBaseURL(baseURL)
    suspend fun signIn(usernameOrEmail: String, password: String): Result<MemberSession> =
        withContext(Dispatchers.IO) {
            runCatching {
                val request = JSONObject()
                    .put("username", usernameOrEmail)
                    .put("password", password)
                    .toString()
                val response = jsonRequest(
                        path = "/api/auth/signin",
                        method = "POST",
                        body = request,
                        rejectedMessage = "Sign-in was not accepted.",
                    )
                MemberSession(
                    cookieHeader = requireNotNull(response.sessionCookie) {
                        "Trustroots did not return a member session."
                    },
                    member = mobileMemberFrom(response.body),
                )
            }
        }

    suspend fun currentMember(session: MemberSession): Result<MobileMember> =
        withContext(Dispatchers.IO) {
            runCatching {
                val response = jsonRequest(
                    path = "/api/users/${session.member.username}",
                    method = "GET",
                    sessionCookie = session.cookieHeader,
                )
                mobileMemberFrom(response.body)
            }
        }

    suspend fun signOut(session: MemberSession): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                jsonRequest(
                    path = "/api/auth/signout",
                    method = "GET",
                    sessionCookie = session.cookieHeader,
                )
                Unit
            }
        }

    private data class JsonResponse(
        val body: JSONObject,
        val sessionCookie: String?,
    )

    private fun jsonRequest(
        path: String,
        method: String,
        body: String? = null,
        sessionCookie: String? = null,
        rejectedMessage: String = "The request was not accepted.",
    ): JsonResponse {
        val endpoint = URL("${baseURL.trimEnd('/')}$path")
        val connection = endpoint.openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "TrustrootsAndroid/0.1")
            sessionCookie?.let { connection.setRequestProperty("Cookie", it) }
            body?.let {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { output -> output.write(it.toByteArray()) }
            }
            val responseBody = (if (connection.responseCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            })?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (connection.responseCode !in 200..299) {
                val message = runCatching { JSONObject(responseBody).optString("message") }
                    .getOrNull()
                    .orEmpty()
                throw MobileApiException(
                    statusCode = connection.responseCode,
                    message = message.ifBlank { rejectedMessage },
                )
            }
            return JsonResponse(
                body = if (responseBody.isBlank()) JSONObject() else JSONObject(responseBody),
                sessionCookie = connection.getHeaderField("Set-Cookie")
                    ?.substringBefore(';')
                    ?.takeIf { it.startsWith("connect.sid=") },
            )
        } finally {
            connection.disconnect()
        }
    }

}

internal fun secureApiBaseURL(value: String): String {
    val url = URL(value.trim())
    val isSecure = url.protocol.equals("https", ignoreCase = true)
    val isLoopbackDevelopment =
        url.protocol.equals("http", ignoreCase = true) &&
            url.host.lowercase() in setOf("localhost", "127.0.0.1", "::1", "10.0.2.2")
    require(isSecure || isLoopbackDevelopment) {
        "The Trustroots API must use HTTPS except for a local emulator endpoint."
    }
    require(url.userInfo == null && url.query == null && url.ref == null) {
        "The Trustroots API address must not contain credentials, a query or a fragment."
    }
    require(url.path.isEmpty() || url.path == "/") {
        "The Trustroots API address must be an origin without a path."
    }
    return value.trim().trimEnd('/')
}

internal fun mobileMemberFrom(member: JSONObject): MobileMember {
    val username = member.getString("username")
    return MobileMember(
        username = username,
        displayName = member.optString("displayName").ifBlank { username },
    )
}
