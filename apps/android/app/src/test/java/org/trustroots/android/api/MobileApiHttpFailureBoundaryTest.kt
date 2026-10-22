package org.trustroots.android.api

import java.io.IOException
import java.net.ServerSocket
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApiHttpFailureBoundaryTest {
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("quiet-fox", "Quiet Fox"),
    )

    @Test fun emptyServiceErrorBodyRetainsStatusAndUsesAContextFreeFailureKind() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 503, body = ""))
            server.start()

            val result = runBlocking {
                MobileApiClient(server.url("/").toString()).accountDetails(session)
            }
            val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
            val error = result.exceptionOrNull() as MobileApiException

            assertEquals("/api/users/quiet-fox", request.url.encodedPath)
            assertEquals(503, error.statusCode)
            assertNull(error.serverMessage)
            assertEquals(ApiFailureKind.REQUEST_REJECTED, error.failureKind)
            assertNull(error.message)
        }
    }

    @Test fun connectionFailureWithoutCacheRemainsAnIoErrorAndDoesNotSetOfflineTimestamp() {
        val unusedPort = ServerSocket(0).use { it.localPort }
        val api = MobileApiClient("http://127.0.0.1:$unusedPort")

        val result = runBlocking { api.accountDetails(session) }

        assertTrue(result.exceptionOrNull() is IOException)
        assertNull(api.offlineSavedAt.value)
    }
}
