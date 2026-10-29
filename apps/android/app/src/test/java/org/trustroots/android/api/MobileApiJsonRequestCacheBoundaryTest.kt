package org.trustroots.android.api

import android.content.Context
import java.io.File
import java.io.IOException
import java.net.ServerSocket
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MobileApiJsonRequestCacheBoundaryTest {
    @Test fun liveGetRemainsSuccessfulWhenItsCacheSnapshotCannotBeWritten() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(
                MockResponse(
                    code = 200,
                    body = """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet@example.test"}""",
                ),
            )
            server.start()
            val account = "quiet-fox-${System.nanoTime()}"
            val context = RuntimeEnvironment.getApplication()
            val baseUrl = server.url("/").toString()
            val responseCacheRoot = File(context.noBackupFilesDir, "response-cache").apply { mkdirs() }
            val blockedScopeDirectory = File(responseCacheRoot, scopeDigest(baseUrl, account))
            assertTrue(blockedScopeDirectory.createNewFile())

            val result = MobileApiClient(baseUrl, SecureResponseCache(context), account).accountDetails(
                MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox")),
            )
            val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))

            assertEquals("quiet-fox", result.getOrThrow().username)
            assertEquals("GET", request.method)
            assertEquals("/api/users/$account", request.url.encodedPath)
        }
    }

    @Test fun connectionFailureWithUnreadableCachedSnapshotRemainsAnIoFailure() = runBlocking {
        val account = "quiet-fox-${System.nanoTime()}"
        val context: Context = RuntimeEnvironment.getApplication()
        val cacheRoot = File(context.noBackupFilesDir, "response-cache")
        val unusedPort = ServerSocket(0).use { it.localPort }
        val baseUrl = "http://127.0.0.1:$unusedPort"
        val path = "/api/users/$account"
        val scopeDirectory = File(cacheRoot, scopeDigest(baseUrl, account)).apply { mkdirs() }
        val policy = requireNotNull(cachePolicy(path, account))
        File(scopeDirectory, "${policy.first}-${digest(path)}").writeBytes(ByteArray(32) { 1 })
        val api = MobileApiClient(baseUrl, SecureResponseCache(context), account)

        val result = api.accountDetails(
            MemberSession("connect.sid=fictional-session", MobileMember(account, "Quiet Fox")),
        )

        assertTrue(result.exceptionOrNull() is IOException)
        assertNull(api.offlineSavedAt.value)
    }

    @Test fun partialCacheConfigurationDoesNotEnableOfflineFallback() = runBlocking {
        val context = RuntimeEnvironment.getApplication()
        val account = "quiet-fox-${System.nanoTime()}"
        val unusedPort = ServerSocket(0).use { it.localPort }
        val baseUrl = "http://127.0.0.1:$unusedPort"
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember(account, "Quiet Fox"),
        )
        val clients = listOf(
            MobileApiClient(baseUrl, responseCache = null, cacheAccount = account),
            MobileApiClient(baseUrl, responseCache = SecureResponseCache(context), cacheAccount = null),
        )

        clients.forEach { api ->
            val result = api.accountDetails(session)

            assertTrue(result.exceptionOrNull() is IOException)
            assertNull(api.offlineSavedAt.value)
        }
    }

    private fun scopeDigest(baseUrl: String, account: String): String =
        digest("${baseUrl.trimEnd('/')}|${account.lowercase()}")

    private fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
