package org.trustroots.android.api

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MobileApiHttpBranchContractsTest {
    @Test
    fun bodylessNotModifiedResponsePreservesStatusWhenNoErrorStreamIsAvailable() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 304))
            server.start()
            val session = MemberSession(
                cookieHeader = "connect.sid=fictional-session",
                member = MobileMember("quiet-fox", "Quiet Fox"),
            )

            val result = runBlocking {
                MobileApiClient(server.url("/").toString()).accountDetails(session)
            }
            val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
            val error = result.exceptionOrNull() as MobileApiException

            assertEquals("GET", request.method)
            assertEquals("/api/users/quiet-fox", request.target)
            assertEquals(304, error.statusCode)
            assertNull(error.serverMessage)
            assertEquals(ApiFailureKind.REQUEST_REJECTED, error.failureKind)
            assertNull(error.message)
        }
    }
}
