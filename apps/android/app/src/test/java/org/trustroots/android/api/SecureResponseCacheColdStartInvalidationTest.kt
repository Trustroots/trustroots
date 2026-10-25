package org.trustroots.android.api

import android.content.Context
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class SecureResponseCacheColdStartInvalidationTest {
    @Test
    fun successfulMembershipWriteIsSafeBeforeAnySnapshotExists() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse(code = 200, body = "{}"))
            val context: Context = RuntimeEnvironment.getApplication()
            val account = "cold-start-${System.nanoTime()}"
            val baseUrl = server.url("/").toString()
            val cache = SecureResponseCache(context)
            val ownProfilePath = "/api/users/$account"
            val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox"))

            assertNull(cache.load(baseUrl, account, ownProfilePath))

            val result = MobileApiClient(baseUrl, cache, account)
                .setCircleMembership(session, "circle-one", isMember = false)

            assertTrue(result.isSuccess)
            val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)
            assertEquals("POST", request?.method)
            assertEquals("/api/users/memberships/circle-one", request?.target)
            assertEquals(session.cookieHeader, request?.headers?.get("Cookie"))
            assertNull(cache.load(baseUrl, account, ownProfilePath))
        }
    }

    @Test
    fun failedBlockMutationPreservesCachedSnapshots() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse(code = 403, body = """{"message":"Request rejected."}"""))
            val account = "failed-block-${System.nanoTime()}"
            val baseUrl = server.url("/").toString()
            val cache = SecureResponseCache(RuntimeEnvironment.getApplication())
            val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox"))
            val snapshots = createSnapshotFiles(RuntimeEnvironment.getApplication(), baseUrl, account)

            val result = MobileApiClient(baseUrl, cache, account)
                .setMemberBlocked(session, "member-one", blocked = true)

            assertTrue(result.isFailure)
            assertEquals(403, (result.exceptionOrNull() as MobileApiException).statusCode)
            val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)
            assertEquals("PUT", request?.method)
            assertEquals("/api/blocked-users/member-one", request?.target)
            snapshots.forEach { (path, _, file) -> assertTrue("Expected $path to remain cached", file.exists()) }
        }
    }

    @Test
    fun successfulBlockMutationClearsOnlyProfileAndProfileDetailSnapshots() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse(code = 200, body = "Member added to block list."))
            val account = "successful-block-${System.nanoTime()}"
            val baseUrl = server.url("/").toString()
            val cache = SecureResponseCache(RuntimeEnvironment.getApplication())
            val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox"))
            val snapshots = createSnapshotFiles(RuntimeEnvironment.getApplication(), baseUrl, account)

            val result = MobileApiClient(baseUrl, cache, account)
                .setMemberBlocked(session, "member-one", blocked = true)

            assertTrue(result.isSuccess)
            val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)
            assertEquals("PUT", request?.method)
            assertEquals("/api/blocked-users/member-one", request?.target)
            snapshots.forEach { (path, category, file) ->
                if (category in setOf("profile", "profile-detail")) {
                    assertFalse("Expected $path to be invalidated", file.exists())
                } else {
                    assertTrue("Expected $path to remain cached", file.exists())
                }
            }
        }
    }

    @Test
    fun blockedMembersReturnsLiveFailureWithoutOfflineFallback() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse(code = 503, body = """{"message":"Temporarily unavailable."}"""))
            val account = "blocked-live-${System.nanoTime()}"
            val baseUrl = server.url("/").toString()
            val cache = SecureResponseCache(RuntimeEnvironment.getApplication())
            val session = MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox"))
            assertNull(cachePolicy("/api/blocked-users", account))

            val result = MobileApiClient(baseUrl, cache, account).blockedMembers(session)

            assertTrue(result.isFailure)
            val error = result.exceptionOrNull() as MobileApiException
            assertEquals(503, error.statusCode)
            assertEquals("Temporarily unavailable.", error.serverMessage)
            val request = server.takeRequest(5, java.util.concurrent.TimeUnit.SECONDS)
            assertEquals("GET", request?.method)
            assertEquals("/api/blocked-users", request?.target)
            assertEquals(session.cookieHeader, request?.headers?.get("Cookie"))
        }
    }

    private data class CacheSnapshotFixture(val path: String, val category: String, val file: File)

    private fun createSnapshotFiles(
        context: Context,
        server: String,
        account: String,
    ): List<CacheSnapshotFixture> = listOf(
        "/api/users/$account" to "own-profile",
        "/api/users/member-one" to "profile",
        "/api/contacts/member-one" to "profile-detail",
        "/api/offers/offer-one" to "offer",
    ).map { (path, expectedCategory) ->
        val policy = requireNotNull(cachePolicy(path, account))
        assertEquals(expectedCategory, policy.first)
        val directory = File(
            File(context.noBackupFilesDir, "response-cache"),
            digest("${server.trimEnd('/')}|${account.lowercase()}"),
        )
        directory.mkdirs()
        val file = File(directory, "${policy.first}-${digest(path)}")
        file.writeBytes(byteArrayOf(1, 2, 3))
        CacheSnapshotFixture(path, policy.first, file)
    }

    private fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
