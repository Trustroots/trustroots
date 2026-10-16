package org.trustroots.android.api

import android.content.Context
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
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
}
