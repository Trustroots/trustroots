package org.trustroots.android.api

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.LocalTransportFixture

@RunWith(AndroidJUnit4::class)
class MobileApiOptionalCacheAccountJourneyTest {
    @Test fun successfulWritesWithConfiguredAccountAndNoCacheReturnTheirApiResults() = runBlocking {
        val account = "steady-heron"
        val session = MemberSession(
            "connect.sid=fictional-write-session",
            MobileMember(account, "Steady Heron"),
        )
        LocalTransportFixture { request ->
            when (request.method to request.path) {
                "POST" to "/api/messages" -> LocalTransportFixture.Response(
                    """{"_id":"fictional-message-one","content":"A fictional greeting","userFrom":{"username":"$account"}}""",
                )
                "DELETE" to "/api/users/memberships/fictional-circle" -> LocalTransportFixture.Response("{}")
                "PUT" to "/api/users" -> LocalTransportFixture.Response(
                    """{"username":"$account","displayName":"Steady Heron","email":"member@example.test","newsletter":true}""",
                )
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.use { local ->
            val api = MobileApiClient(
                local.baseURL,
                responseCache = null,
                cacheAccount = "fictional-unbacked-account",
            )

            val message = api.sendMessage(session, "calm-lynx", "  A fictional greeting  ").getOrThrow()
            assertEquals("fictional-message-one", message.id)
            assertEquals("A fictional greeting", message.content)
            assertEquals(account, message.sender.username)

            assertTrue(api.setCircleMembership(session, "fictional-circle", isMember = true).isSuccess)

            val updatedAccount = api.updateAccount(session, " member@example.test ", newsletter = true).getOrThrow()
            assertEquals(account, updatedAccount.username)
            assertEquals("Steady Heron", updatedAccount.displayName)
            assertEquals("member@example.test", updatedAccount.email)
            assertTrue(updatedAccount.newsletter)

            assertNull(api.offlineSavedAt.value)
            assertEquals(3, local.requests.size)
            assertEquals(
                listOf(
                    "POST" to "/api/messages",
                    "DELETE" to "/api/users/memberships/fictional-circle",
                    "PUT" to "/api/users",
                ),
                local.requests.map { it.method to it.path },
            )
            assertTrue(local.requests.all { it.cookie == session.cookieHeader })

            val messagePayload = JSONObject(local.requests[0].body)
            assertEquals("calm-lynx", messagePayload.getString("userTo"))
            assertEquals("A fictional greeting", messagePayload.getString("content"))
            assertTrue(local.requests[1].body.isEmpty())
            val accountPayload = JSONObject(local.requests[2].body)
            assertEquals("member@example.test", accountPayload.getString("email"))
            assertTrue(accountPayload.getBoolean("newsletter"))
        }
    }

    @Test fun nonGetTransportFailureWithConfiguredAccountPropagatesWithoutCacheFallback() = runBlocking {
        val session = MemberSession(
            "connect.sid=fictional-offline-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        LocalTransportFixture { null }.use { local ->
            val api = MobileApiClient(
                local.baseURL,
                responseCache = null,
                cacheAccount = "fictional-unbacked-account",
            )

            val result = api.sendMessage(session, "calm-lynx", "A fictional offline greeting")

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is IOException)
            assertNull(api.offlineSavedAt.value)
            val requests = local.requests.toList()
            assertTrue("The fixture should receive the authenticated message request", requests.isNotEmpty())
            assertTrue(
                "Every retry should preserve the same POST and payload",
                requests.all { request ->
                    val payload = JSONObject(request.body)
                    request.method == "POST" &&
                        request.path == "/api/messages" &&
                        request.cookie == session.cookieHeader &&
                        payload.getString("userTo") == "calm-lynx" &&
                        payload.getString("content") == "A fictional offline greeting"
                },
            )
        }
    }

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
