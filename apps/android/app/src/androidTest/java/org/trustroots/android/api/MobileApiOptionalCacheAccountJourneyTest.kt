package org.trustroots.android.api

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.LocalTransportFixture

@RunWith(AndroidJUnit4::class)
class MobileApiOptionalCacheAccountJourneyTest {
    @Test fun offlineReadWithConfiguredAccountButNoCachePropagatesTransportFailure() = runBlocking {
        LocalTransportFixture { null }.use { local ->
            val session = MemberSession(
                "connect.sid=fictional-offline-session",
                MobileMember("steady-heron", "Steady Heron"),
            )
            val api = MobileApiClient(
                local.baseURL,
                responseCache = null,
                cacheAccount = "fictional-unbacked-account",
            )

            val result = api.accountDetails(session)

            assertTrue(result.exceptionOrNull() is IOException)
            assertNull(api.offlineSavedAt.value)
            val requests = local.requests.toList()
            assertTrue("The fixture should receive the authenticated account request", requests.isNotEmpty())
            assertTrue(
                "Every retried request should remain the same authenticated GET",
                requests.all { request ->
                    request.method == "GET" &&
                        request.path == "/api/users/steady-heron" &&
                        request.cookie == session.cookieHeader &&
                        request.body.isEmpty()
                },
            )
        }
    }

    @Test fun clearingAnUnscopedOrUncachedClientKeepsOtherAccountSnapshotAndLiveReadsWorking() = runBlocking {
        val responseIndex = AtomicInteger()
        LocalTransportFixture { request ->
            if (request.method == "GET" && request.path == "/api/users/steady-heron") {
                val displayName = when (responseIndex.getAndIncrement()) {
                    0 -> "Fresh Fictional Name"
                    1 -> "Another Fresh Name"
                    else -> error("Unexpected extra account read")
                }
                LocalTransportFixture.Response(
                    """{"username":"steady-heron","displayName":"$displayName","email":"member@example.test"}""",
                )
            } else {
                error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.use { local ->
            val baseURL = local.baseURL
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val cache = SecureResponseCache(context)
            val otherAccount = "fictional-cached-account-${System.nanoTime()}"
            val unrelatedPath = "/api/users/$otherAccount"
            val cachedBody = """{"username":"$otherAccount","displayName":"Cached Fictional Member"}"""
            try {
                cache.save(baseURL, otherAccount, unrelatedPath, cachedBody)
                assertEquals(cachedBody, cache.load(baseURL, otherAccount, unrelatedPath)?.body)

                val session = MemberSession(
                    "connect.sid=fictional-cache-session",
                    MobileMember("steady-heron", "Steady Heron"),
                )
                val cacheWithoutAccount = MobileApiClient(baseURL, responseCache = cache, cacheAccount = null)
                cacheWithoutAccount.clearCachedAccount()
                assertEquals("Fresh Fictional Name", cacheWithoutAccount.accountDetails(session).getOrThrow().displayName)

                val accountWithoutCache = MobileApiClient(
                    baseURL,
                    responseCache = null,
                    cacheAccount = "fictional-unbacked-account",
                )
                accountWithoutCache.clearCachedAccount()
                assertEquals("Another Fresh Name", accountWithoutCache.accountDetails(session).getOrThrow().displayName)

                assertEquals(2, local.requests.size)
                assertEquals(listOf("GET", "GET"), local.requests.map { it.method })
                assertEquals(
                    listOf("/api/users/steady-heron", "/api/users/steady-heron"),
                    local.requests.map { it.path },
                )
                assertTrue(local.requests.all { it.cookie == session.cookieHeader && it.body.isEmpty() })
                assertEquals(cachedBody, cache.load(baseURL, otherAccount, unrelatedPath)?.body)
            } finally {
                cache.clear(baseURL, otherAccount)
                cache.clear(baseURL, "fictional-unbacked-account")
            }
        }
    }
}
