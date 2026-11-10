package org.trustroots.android.api

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.MemberShellViewModelStoreOwner
import org.trustroots.android.ui.session.AndroidAppSessionOperations
import org.trustroots.android.ui.signin.SignInDestinationStoreHolder

@RunWith(AndroidJUnit4::class)
class SecureMobileSessionStoreTest {
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private lateinit var originalPreferences: Map<String, *>
    private lateinit var store: SecureMobileSessionStore

    @Before
    fun setUp() {
        originalPreferences = preferences.all
        preferences.edit().clear().commit()
        store = SecureMobileSessionStore(context)
    }

    @After
    fun restorePreferences() {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        originalPreferences.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }

    @Test
    fun savesAndLoadsTheCurrentMemberSessionWithoutPlaintextPreferences() {
        val session = MemberSession(
            cookieHeader = "connect.sid=fictitious-cookie",
            member = MobileMember("quiet-fox", "Quiet Fox"),
        )

        store.save(session)

        assertEquals(session, store.load())
        assertEquals(setOf("payload", "iv"), preferences.all.keys)
        assertTrue(preferences.all.values.filterIsInstance<String>().none {
            it.contains(session.cookieHeader) || it.contains(session.member.username) ||
                it.contains(session.member.displayName)
        })
    }

    @Test
    fun persistsRotatedBearerTokensWithoutPlaintextPreferences() {
        val session = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "example-access", "example-refresh")
        store.save(session)
        assertEquals(session, store.load())
        assertTrue(preferences.all.values.filterIsInstance<String>().none {
            it.contains("example-access") || it.contains("example-refresh")
        })
    }

    @Test
    fun restoresBearerSessionsByRefreshingAndPersistingTheRotation() = runBlocking {
        val saved = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "old-access", "old-refresh")
        store.save(saved)
        LocalTransportFixture { request ->
            assertEquals("POST", request.method)
            assertEquals("/api/mobile/v0/auth/refresh", request.path)
            assertEquals("old-refresh", org.json.JSONObject(request.body).getString("refreshToken"))
            assertNull(request.cookie)
            LocalTransportFixture.Response("""{"accessToken":"new-access","refreshToken":"new-refresh","member":{"username":"quiet-fox","displayName":"Quiet Fox"}}""")
        }.use { local ->
            val refreshed = operations(local.baseURL).loadSession()
            assertEquals(
                saved.copy(accessToken = "new-access", refreshToken = "new-refresh", localSessionId = saved.sessionId),
                refreshed,
            )
            assertEquals(refreshed, store.load())
        }
    }

    @Test
    fun concurrentRequestsRefreshOnceAndRetryWithPersistedCredentials() = runBlocking {
        val saved = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "old-access", "old-refresh")
        store.save(saved)
        val account = """{"username":"quiet-fox","displayName":"Quiet Fox","email":"fox@example.invalid"}"""
        LocalTransportFixture { request ->
            when {
                request.path == "/api/mobile/v0/auth/refresh" -> {
                    assertEquals("old-refresh", org.json.JSONObject(request.body).getString("refreshToken"))
                    LocalTransportFixture.Response(
                        """{"accessToken":"new-access","refreshToken":"new-refresh","member":$account}""",
                    )
                }
                request.authorization == "Bearer old-access" -> LocalTransportFixture.Response("{}", 401)
                else -> {
                    assertEquals("Bearer new-access", request.authorization)
                    LocalTransportFixture.Response(account)
                }
            }
        }.use { local ->
            val results = List(4) {
                async {
                    MobileApiClient(local.baseURL, sessionStore = store)
                        .updateAccount(saved, "fox@example.invalid", newsletter = true).getOrThrow()
                }
            }.awaitAll()
            assertTrue(results.all { it.username == saved.member.username })
            assertEquals(1, local.requests.count { it.path == "/api/mobile/v0/auth/refresh" })
            assertEquals(4, local.requests.count { it.authorization == "Bearer new-access" })
            val accountRequests = local.requests.filter { it.authorization != null }
            assertTrue(accountRequests.all { it.method == "PUT" && it.path == accountRequests.first().path })
            assertEquals(setOf("""{"email":"fox@example.invalid","newsletter":true}"""), accountRequests.map { it.body }.toSet())
            assertEquals("new-refresh", SecureMobileSessionStore(context).load()?.refreshToken)
            store.updateMember(saved.copy(member = saved.member.copy(displayName = "Updated Fox")))
            assertEquals("new-access", store.load()?.accessToken)
            assertEquals("Updated Fox", store.load()?.member?.displayName)
        }
    }

    @Test
    fun temporaryRefreshFailureDuringAnAuthenticatedRequestKeepsTheSavedSession() = runBlocking {
        val saved = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "old-access", "old-refresh")
        store.save(saved)
        LocalTransportFixture { request ->
            LocalTransportFixture.Response("{}", if (request.authorization == null) 503 else 401)
        }.use { local ->
            val result = MobileApiClient(local.baseURL, sessionStore = store).accountDetails(saved)
            assertEquals(503, (result.exceptionOrNull() as MobileApiException).statusCode)
            assertEquals(saved, store.load())
            assertEquals(2, local.requests.size)
        }
    }

    @Test
    fun refreshRejectionClearsTheSessionButTemporaryFailuresKeepIt() = runBlocking {
        val saved = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "example-access", "example-refresh")
        for (status in listOf(401, 500)) {
            store.save(saved)
            LocalTransportFixture { LocalTransportFixture.Response("{}", status) }.use { local ->
                val restored = operations(local.baseURL).loadSession()
                assertEquals(if (status == 401) null else saved, restored)
                assertEquals(restored, store.load())
            }
        }
        store.save(saved)
        LocalTransportFixture { null }.use { local ->
            assertEquals(saved, operations(local.baseURL).loadSession())
            assertEquals(saved, store.load())
        }
    }

    private fun operations(backendURL: String) = AndroidAppSessionOperations(
        store,
        SecureResponseCache(context),
        SignInDestinationStoreHolder(),
        MemberShellViewModelStoreOwner(),
        backendURL,
    )

    @Test
    fun staleSessionCannotUpdateOrClearReplacementCredentials() {
        val member = MobileMember("quiet-fox", "Quiet Fox")
        val bearer = MemberSession("", member, "old-access", "old-refresh")
        val replacement = bearer.copy(accessToken = "replacement-access")
        store.updateMember(bearer)
        store.clearIfCurrent(bearer)
        val missing = runCatching { store.currentBearerSession(bearer) }
        assertEquals(401, (missing.exceptionOrNull() as MobileApiException).statusCode)
        store.save(replacement)
        store.updateMember(bearer)
        store.clearIfCurrent(bearer)
        val rejected = runCatching { store.currentBearerSession(bearer) }
        assertEquals(401, (rejected.exceptionOrNull() as MobileApiException).statusCode)
        assertEquals(replacement, store.load())

        val legacy = MemberSession("connect.sid=first-cookie", member)
        store.save(legacy)
        store.updateMember(legacy.copy(cookieHeader = "connect.sid=stale-cookie", member = member.copy(displayName = "Stale")))
        assertEquals(legacy, store.load())
    }

    @Test
    fun rotationKeepsConcurrentProfileEditsAndOnlyPublishesToTheMatchingSession() {
        val member = MobileMember("quiet-fox", "Quiet Fox")
        val saved = MemberSession("", member, "old-access", "old-refresh")
        val refreshed = saved.copy(accessToken = "new-access", localSessionId = saved.sessionId)
        val edited = member.copy(displayName = "Updated Fox")
        assertNull(store.renewedSession.value.renewedAccessTokenFor(saved))
        store.save(saved)

        val updated = store.rotateBearerSession(saved) {
            store.updateMember(saved.copy(member = edited))
            refreshed
        }

        assertEquals(refreshed.copy(member = edited), updated)
        assertEquals(updated, store.load())
        assertEquals(updated, store.rotateBearerSession(saved) { error("Credentials already rotated") })
        assertEquals("new-access", store.renewedSession.value.renewedAccessTokenFor(saved))
        val other = saved.copy(accessToken = "other-access")
        assertNull(store.renewedSession.value.renewedAccessTokenFor(other))
    }

    @Test
    fun failedDurableWriteDoesNotPublishTheRotation() {
        val saved = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "old-access", "old-refresh")
        store.save(saved)
        val original = preferences
        val failingContext = object : ContextWrapper(context) {
            override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
                object : SharedPreferences by original {
                    override fun edit(): SharedPreferences.Editor =
                        object : SharedPreferences.Editor by original.edit() {
                            override fun putString(key: String?, value: String?): SharedPreferences.Editor = this
                            override fun commit(): Boolean = false
                        }
                }
        }
        val failingStore = SecureMobileSessionStore(failingContext)

        val rotation = runCatching {
            failingStore.rotateBearerSession(saved) { saved.copy(accessToken = "new-access") }
        }

        assertTrue(rotation.exceptionOrNull() is IOException)
        assertEquals(saved, store.load())
        assertNull(store.renewedSession.value)
    }

    @Test
    fun replacingSessionReturnsOnlyTheMostRecentlySavedAccount() {
        val first = MemberSession("connect.sid=first-fake-cookie", MobileMember("first-owl", "First Owl"))
        val second = MemberSession("connect.sid=second-fake-cookie", MobileMember("second-fox", "Second Fox"))

        store.save(first)
        store.save(second)

        assertEquals(second, store.load())
    }

    @Test
    fun missingOrCorruptedStoredValuesLoadAsNoSession() {
        store.save(MemberSession("connect.sid=fake-cookie", MobileMember("calm-lynx", "Calm Lynx")))
        preferences.edit().remove("iv").commit()
        assertNull(store.load())

        store.save(MemberSession("connect.sid=fake-cookie", MobileMember("calm-lynx", "Calm Lynx")))
        preferences.edit().putString("payload", "not-base64!").commit()
        assertNull(store.load())

        store.save(MemberSession("connect.sid=fake-cookie", MobileMember("calm-lynx", "Calm Lynx")))
        val payload = preferences.getString("payload", null)!!
        val encryptedBytes = Base64.decode(payload, Base64.NO_WRAP)
        encryptedBytes[0] = (encryptedBytes[0].toInt() xor 1).toByte()
        preferences.edit().putString("payload", Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)).commit()
        assertNull(store.load())
    }

    @Test
    fun clearRemovesTheSavedSession() {
        store.save(MemberSession("connect.sid=fake-cookie", MobileMember("calm-lynx", "Calm Lynx")))

        store.clear()

        assertNull(store.load())
        assertTrue(preferences.all.isEmpty())
    }

    private companion object {
        const val PREFERENCES_NAME = "mobile-session"
    }
}
