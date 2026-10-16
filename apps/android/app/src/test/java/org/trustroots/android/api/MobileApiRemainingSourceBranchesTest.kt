package org.trustroots.android.api

import java.io.IOException
import java.net.ServerSocket
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApiRemainingSourceBranchesTest {
    @Test
    fun blankOfferIDUsesCreateEndpointInsteadOfAnUpdateEndpoint() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 200, body = """{"_id":"offer-created","status":"yes"}"""))
            server.start()
            val session = MemberSession(
                "connect.sid=fictional-session",
                MobileMember("steady-heron", "Steady Heron"),
            )

            val result = MobileApiClient(server.url("/").toString()).saveHostOffer(
                session,
                HostOfferUpdate(
                    id = " \t ",
                    status = "yes",
                    description = "A fictional room",
                    noOfferDescription = "",
                    maxGuests = 1,
                    showOnlyInMyCircles = false,
                    latitude = 12.5,
                    longitude = 30.25,
                ),
            )
            val request = server.takeRequest(5, TimeUnit.SECONDS)

            assertTrue(result.isSuccess)
            assertEquals("POST", request?.method)
            assertEquals("/api/offers", request?.target)
        }
    }

    @Test
    fun contactLookupPreservesTransportFailuresInsteadOfTreatingThemAsMissingRelationships() = runBlocking {
        val unusedPort = ServerSocket(0).use { it.localPort }
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )

        val result = MobileApiClient("http://127.0.0.1:$unusedPort")
            .contactWith(session, "quiet-fox")

        assertTrue(result.exceptionOrNull() is IOException)
    }
}
