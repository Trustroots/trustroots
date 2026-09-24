package org.trustroots.android.api

import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

data class MobileMember(
    val username: String,
    val displayName: String,
)

data class MemberSession(
    val cookieHeader: String,
    val member: MobileMember,
)

data class MemberProfile(
    val id: String?,
    val username: String,
    val displayName: String,
    val tagline: String?,
    val description: String?,
    val location: String?,
    val locationLiving: String? = null,
    val locationFrom: String? = null,
    val languages: List<String>,
    val circles: List<TrustrootsCircle> = emptyList(),
)

data class ProfileUpdate(
    val displayName: String,
    val tagline: String,
    val description: String,
    val locationLiving: String,
    val locationFrom: String,
    val languages: List<String>,
)

data class MessageMember(val id: String?, val username: String?, val displayName: String) {
    val label: String get() = displayName.ifBlank { username ?: "Trustroots member" }
}

data class MessageThread(
    val id: String,
    val otherMember: MessageMember,
    val excerpt: String,
    val read: Boolean,
)

data class DirectMessage(val id: String, val content: String, val sender: MessageMember, val createdAt: Long? = null)

data class MapOffer(val id: String, val latitude: Double, val longitude: Double, val type: String = "host", val status: String = "yes")

data class HostOffer(
    val id: String,
    val status: String?,
    val description: String?,
    val maxGuests: Int?,
    val user: MessageMember,
)

data class AccommodationOffer(
    val status: String?,
    val description: String?,
    val noOfferDescription: String?,
    val maxGuests: Int?,
)

data class ProfileContact(val id: String, val user: MessageMember)

data class ProfileReference(
    val id: String,
    val author: MessageMember,
    val feedback: String?,
    val recommendation: String?,
    val response: String?,
)

data class TrustrootsCircle(
    val id: String,
    val slug: String,
    val label: String,
    val description: String?,
    val count: Int,
    val image: Boolean,
    val color: String?,
)

class MobileApiException(
    val statusCode: Int,
    override val message: String,
) : Exception(message) {
    val isAuthenticationFailure: Boolean
        get() = statusCode == HttpURLConnection.HTTP_UNAUTHORIZED
}

class MobileApiClient(
    baseURL: String,
    private val responseCache: SecureResponseCache? = null,
    private val cacheAccount: String? = null,
) {
    private val baseURL = secureApiBaseURL(baseURL)
    private val mutableOfflineSavedAt = MutableStateFlow<Long?>(null)
    val offlineSavedAt = mutableOfflineSavedAt.asStateFlow()

    fun clearCachedAccount() {
        cacheAccount?.let { responseCache?.clear(baseURL, it) }
        mutableOfflineSavedAt.value = null
    }
    fun circleImageURL(slug: String): URL =
        URL("$baseURL/uploads-circle/${encode(slug).replace("+", "%20")}/120x120.jpg")
    fun circleHeroURL(slug: String): URL =
        URL("$baseURL/uploads-circle/${encode(slug).replace("+", "%20")}/742x496.jpg")
    fun avatarURL(memberID: String, size: Int = 128): URL =
        URL("$baseURL/api/users/${encode(memberID)}/avatar?size=$size")
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
                    member = mobileMemberFrom(JSONObject(response.body)),
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
                mobileMemberFrom(JSONObject(response.body))
            }
        }

    suspend fun contacts(session: MemberSession, memberID: String): Result<List<ProfileContact>> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseContacts(JSONArray(jsonRequest(
                    "/api/contacts/${encode(memberID)}", "GET", sessionCookie = session.cookieHeader,
                ).body))
            }
        }

    suspend fun references(session: MemberSession, memberID: String): Result<List<ProfileReference>> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseReferences(JSONArray(jsonRequest(
                    "/api/experiences?userTo=${encode(memberID)}", "GET", sessionCookie = session.cookieHeader,
                ).body))
            }
        }

    suspend fun visibleNostrAuthors(session: MemberSession, authors: Set<String>): Result<Set<String>> =
        withContext(Dispatchers.IO) {
            runCatching {
                if (authors.isEmpty()) return@runCatching emptySet()
                authors.chunked(100).flatMap { batch ->
                    val query = batch.joinToString("&") { "pubkey=${encode(it)}" }
                    val payload = JSONObject(jsonRequest(
                        "/api/nostr/author-visibility?$query", "GET", sessionCookie = session.cookieHeader,
                    ).body)
                    val linked = payload.getJSONArray("linkedPubkeys").let { array ->
                        (0 until array.length()).map { array.getString(it).lowercase() }.toSet()
                    }
                    val visible = payload.getJSONArray("pubkeys").let { array ->
                        (0 until array.length()).map { array.getString(it).lowercase() }.toSet()
                    }
                    batch.filter { it !in linked || it in visible }
                }
                    .toSet()
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

    suspend fun searchMembers(session: MemberSession, query: String): Result<List<MemberProfile>> =
        withContext(Dispatchers.IO) {
            runCatching {
                require(query.trim().length >= 3)
                val path = "/api/users?search=${encode(query.trim())}&limit=50"
                val body = jsonRequest(path, "GET", sessionCookie = session.cookieHeader).body
                parseMembers(JSONArray(body))
            }
        }

    suspend fun profile(session: MemberSession, username: String): Result<MemberProfile> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseMember(JSONObject(jsonRequest(
                    "/api/users/${encode(username)}", "GET", sessionCookie = session.cookieHeader,
                ).body))
            }
        }

    suspend fun updateProfile(session: MemberSession, update: ProfileUpdate): Result<MemberProfile> =
        withContext(Dispatchers.IO) {
            runCatching {
                require(update.displayName.isNotBlank())
                val body = JSONObject()
                    .put("displayName", update.displayName.trim())
                    .put("tagline", update.tagline.trim())
                    .put("description", update.description.trim())
                    .put("locationLiving", update.locationLiving.trim())
                    .put("locationFrom", update.locationFrom.trim())
                    .put("languages", JSONArray(update.languages.distinct().sorted()))
                    .toString()
                parseMember(JSONObject(jsonRequest(
                    "/api/users", "PUT", body, session.cookieHeader,
                ).body))
            }
        }

    suspend fun inbox(session: MemberSession, page: Int = 1): Result<List<MessageThread>> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseThreads(
                    JSONArray(jsonRequest(
                        "/api/messages?page=$page&limit=50", "GET", sessionCookie = session.cookieHeader,
                    ).body),
                    session.member.username,
                )
            }
        }

    suspend fun conversation(session: MemberSession, memberID: String): Result<List<DirectMessage>> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseMessages(JSONArray(jsonRequest(
                    "/api/messages/${encode(memberID)}?limit=100", "GET",
                    sessionCookie = session.cookieHeader,
                ).body))
            }
        }

    suspend fun sendMessage(session: MemberSession, memberID: String, content: String): Result<DirectMessage> =
        withContext(Dispatchers.IO) {
            runCatching {
                require(content.isNotBlank())
                val body = JSONObject().put("userTo", memberID).put("content", content.trim()).toString()
                parseMessage(JSONObject(jsonRequest(
                    "/api/messages", "POST", body, session.cookieHeader,
                ).body))
            }
        }

    suspend fun searchOffers(
        session: MemberSession,
        south: Double,
        west: Double,
        north: Double,
        east: Double,
        types: Set<String> = setOf("host"),
        circleIDs: Set<String> = emptySet(),
        seenMonths: Int? = 6,
    ): Result<List<MapOffer>> = withContext(Dispatchers.IO) {
        runCatching {
            require(south < north && west < east)
            require(types.isNotEmpty() && types.all { it in setOf("host", "meet") })
            require(seenMonths == null || seenMonths in 1..24)
            val filterObject = JSONObject()
                .put("types", JSONArray(types.sorted()))
                .put("tribes", JSONArray(circleIDs.sorted()))
            if (seenMonths != null) filterObject.put("seen", JSONObject().put("months", seenMonths))
            val filters = encode(filterObject.toString())
            val path = "/api/offers?southWestLat=$south&southWestLng=$west" +
                "&northEastLat=$north&northEastLng=$east&filters=$filters"
            parseMapOffers(JSONObject(jsonRequest(path, "GET", sessionCookie = session.cookieHeader).body))
        }
    }

    suspend fun hostOffer(session: MemberSession, offerID: String): Result<HostOffer> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseHostOffer(JSONObject(jsonRequest(
                    "/api/offers/${encode(offerID)}", "GET", sessionCookie = session.cookieHeader,
                ).body))
            }
        }

    suspend fun accommodationOffer(session: MemberSession, memberID: String): Result<AccommodationOffer?> =
        withContext(Dispatchers.IO) {
            runCatching {
                val offers = JSONArray(jsonRequest(
                    "/api/offers-by/${encode(memberID)}?types=host", "GET",
                    sessionCookie = session.cookieHeader,
                ).body)
                if (offers.length() == 0) null else parseAccommodationOffer(offers.getJSONObject(0))
            }
        }

    suspend fun circles(session: MemberSession): Result<List<TrustrootsCircle>> =
        withContext(Dispatchers.IO) {
            runCatching {
                parseCircles(JSONArray(jsonRequest(
                    "/api/tribes?limit=150", "GET", sessionCookie = session.cookieHeader,
                ).body))
            }
        }

    suspend fun circleMemberships(session: MemberSession): Result<Set<String>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val memberships = JSONArray(jsonRequest(
                    "/api/users/memberships", "GET", sessionCookie = session.cookieHeader,
                ).body)
                (0 until memberships.length()).mapNotNull { index ->
                    memberships.getJSONObject(index).optJSONObject("tribe")?.let {
                        it.optionalText("_id") ?: it.optionalText("id")
                    }
                }.toSet()
            }
        }

    suspend fun setCircleMembership(
        session: MemberSession,
        circleID: String,
        isMember: Boolean,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            jsonRequest(
                "/api/users/memberships/${encode(circleID)}",
                if (isMember) "DELETE" else "POST",
                sessionCookie = session.cookieHeader,
            )
            Unit
        }
    }

    private data class JsonResponse(
        val body: String,
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
            if (method == "GET" && sessionCookie != null && cacheAccount != null) {
                responseCache?.save(baseURL, cacheAccount, path, responseBody)
            } else if (method != "GET" && sessionCookie != null && cacheAccount != null) {
                when {
                    path == "/api/messages" -> responseCache?.clearCategories(
                        baseURL, cacheAccount, setOf("inbox", "thread"),
                    )
                    path.startsWith("/api/users/memberships/") -> responseCache?.clearCategories(
                        baseURL, cacheAccount, setOf("own-profile", "profile"),
                    )
                    path == "/api/users" -> responseCache?.clearCategories(
                        baseURL, cacheAccount, setOf("own-profile"),
                    )
                }
            }
            mutableOfflineSavedAt.value = null
            return JsonResponse(
                body = responseBody.ifBlank { "{}" },
                sessionCookie = sessionCookieFrom(connection.headerFields),
            )
        } catch (error: IOException) {
            val cached = if (method == "GET" && sessionCookie != null && cacheAccount != null) {
                responseCache?.load(baseURL, cacheAccount, path)
            } else null
            if (cached != null) {
                mutableOfflineSavedAt.value = cached.savedAt
                return JsonResponse(cached.body, null)
            }
            throw error
        } finally {
            connection.disconnect()
        }
    }

}

internal fun sessionCookieFrom(headers: Map<String?, List<String>>): String? =
    headers.entries
        .asSequence()
        .filter { (name) -> name.equals("Set-Cookie", ignoreCase = true) }
        .flatMap { (_, values) -> values.asSequence() }
        .map { it.substringBefore(';') }
        .firstOrNull { it.startsWith("connect.sid=") }

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

private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())

private fun JSONObject.optionalText(key: String): String? =
    optString(key).trim().takeIf { it.isNotEmpty() }

internal fun parseMember(value: JSONObject): MemberProfile {
    val username = value.getString("username")
    val languages = value.optJSONArray("languages")
    val memberships = value.optJSONArray("member")
    return MemberProfile(
        id = value.optionalText("_id") ?: value.optionalText("id"),
        username = username,
        displayName = value.optionalText("displayName") ?: username,
        tagline = value.optionalText("tagline"),
        description = value.optionalText("description"),
        location = value.optionalText("locationLiving")
            ?: value.optionalText("locationFrom")?.let { "From $it" },
        locationLiving = value.optionalText("locationLiving"),
        locationFrom = value.optionalText("locationFrom"),
        languages = if (languages == null) emptyList() else (0 until languages.length())
            .mapNotNull { languages.optString(it).takeIf(String::isNotBlank) },
        circles = if (memberships == null) emptyList() else (0 until memberships.length())
            .mapNotNull { memberships.optJSONObject(it)?.optJSONObject("tribe") }
            .mapNotNull { parseCircleOrNull(it) },
    )
}

internal fun parseMembers(values: JSONArray): List<MemberProfile> =
    (0 until values.length()).map { parseMember(values.getJSONObject(it)) }

private fun parseMessageMember(value: JSONObject): MessageMember = MessageMember(
    id = value.optionalText("_id") ?: value.optionalText("id"),
    username = value.optionalText("username"),
    displayName = value.optionalText("displayName").orEmpty(),
)

internal fun parseThreads(values: JSONArray, currentUsername: String): List<MessageThread> =
    (0 until values.length()).map { index ->
        val value = values.getJSONObject(index)
        val from = parseMessageMember(value.getJSONObject("userFrom"))
        val to = parseMessageMember(value.getJSONObject("userTo"))
        MessageThread(
            id = value.getString("_id"),
            otherMember = if (from.username == currentUsername) to else from,
            excerpt = value.optJSONObject("message")?.optionalText("excerpt").orEmpty(),
            read = value.optBoolean("read", true),
        )
    }

internal fun parseMessage(value: JSONObject): DirectMessage = DirectMessage(
    id = value.getString("_id"),
    content = value.getString("content"),
    sender = parseMessageMember(value.getJSONObject("userFrom")),
    createdAt = value.optionalText("created")?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() },
)

internal fun parseMessages(values: JSONArray): List<DirectMessage> =
    (0 until values.length()).map { parseMessage(values.getJSONObject(it)) }

internal fun parseContacts(values: JSONArray): List<ProfileContact> =
    (0 until values.length()).mapNotNull { index ->
        val item = values.optJSONObject(index) ?: return@mapNotNull null
        val user = item.optJSONObject("user") ?: return@mapNotNull null
        ProfileContact(item.optionalText("_id") ?: return@mapNotNull null, parseMessageMember(user))
    }

internal fun parseReferences(values: JSONArray): List<ProfileReference> =
    (0 until values.length()).mapNotNull { index ->
        val item = values.optJSONObject(index) ?: return@mapNotNull null
        val author = item.optJSONObject("userFrom") ?: return@mapNotNull null
        ProfileReference(
            id = item.optionalText("_id") ?: return@mapNotNull null,
            author = parseMessageMember(author),
            feedback = item.optionalText("feedbackPublic"),
            recommendation = item.optionalText("recommend"),
            response = item.optJSONObject("response")?.optionalText("feedbackPublic"),
        )
    }

internal fun parseMapOffers(value: JSONObject): List<MapOffer> {
    val features = value.getJSONArray("features")
    return (0 until features.length()).mapNotNull { index ->
        val feature = features.getJSONObject(index)
        val coordinates = feature.getJSONObject("geometry").getJSONArray("coordinates")
        if (coordinates.length() != 2) return@mapNotNull null
        val longitude = coordinates.getDouble(0)
        val latitude = coordinates.getDouble(1)
        if (!latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
            return@mapNotNull null
        }
        val properties = feature.getJSONObject("properties")
        MapOffer(
            properties.getString("id"), latitude, longitude,
            properties.optString("type", "host"),
            properties.optString("status", "yes"),
        )
    }
}

internal fun parseHostOffer(value: JSONObject): HostOffer = HostOffer(
    id = value.getString("_id"),
    status = value.optionalText("status"),
    description = value.optionalText("description") ?: value.optionalText("noOfferDescription"),
    maxGuests = value.optInt("maxGuests").takeIf { value.has("maxGuests") && !value.isNull("maxGuests") },
    user = parseMessageMember(value.getJSONObject("user")),
)

internal fun parseAccommodationOffer(value: JSONObject): AccommodationOffer = AccommodationOffer(
    status = value.optionalText("status"),
    description = value.optionalText("description"),
    noOfferDescription = value.optionalText("noOfferDescription"),
    maxGuests = value.optInt("maxGuests").takeIf { value.has("maxGuests") && !value.isNull("maxGuests") },
)

internal fun parseCircles(values: JSONArray): List<TrustrootsCircle> =
    (0 until values.length()).mapNotNull { parseCircleOrNull(values.getJSONObject(it)) }

private fun parseCircleOrNull(value: JSONObject): TrustrootsCircle? {
    val id = value.optionalText("_id") ?: value.optionalText("id") ?: return null
    val slug = value.optionalText("slug") ?: return null
    val label = value.optionalText("label") ?: return null
    return TrustrootsCircle(
        id = id,
        slug = slug,
        label = label,
        description = value.optionalText("description"),
        count = value.optInt("count"),
        image = value.optBoolean("image"),
        color = value.optionalText("color"),
    )
}
