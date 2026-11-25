package org.trustroots.android.ui.hostoffer

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember

class MobileApiHostOfferRepositoryTest {
    private val update = HostOfferForm(
        description = "A quiet fictional room",
        latitude = "41.1",
        longitude = "-8.5",
    ).toUpdate()

    @Test
    fun retryUpdatesAnOfferIfTheOriginalCreateActuallySucceeded() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(profile())
            server.enqueue(MockResponse(body = "[]"))
            server.enqueue(MockResponse(code = 502, body = "{}"))
            server.enqueue(MockResponse(code = 503, body = "{}"))
            server.enqueue(MockResponse(body = """[{"_id":"existing-offer"}]"""))
            server.enqueue(MockResponse(body = """{"message":"Saved"}"""))
            val repository = repository(server)

            assertNull(repository.load().getOrThrow().id)
            assertEquals(502, (repository.save(update).exceptionOrNull() as MobileApiException).statusCode)
            assertEquals(503, (repository.save(update).exceptionOrNull() as MobileApiException).statusCode)
            assertEquals("existing-offer", repository.save(update).getOrThrow().id)
            assertRequests(server,
                "GET /api/users/quiet-fox",
                "GET /api/offers-by/member-one?types=host",
                "POST /api/offers",
                "GET /api/offers-by/member-one?types=host",
                "GET /api/offers-by/member-one?types=host",
                "PUT /api/offers/existing-offer",
            )
        }
    }

    @Test
    fun retryCreatesAnOfferIfTheOriginalAttemptDidNotLeaveAnOffer() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(profile())
            server.enqueue(MockResponse(body = "[]"))
            server.enqueue(MockResponse(code = 502, body = "{}"))
            server.enqueue(MockResponse(code = 404, body = "{}"))
            server.enqueue(MockResponse(body = """{"_id":"new-offer"}"""))
            val repository = repository(server)

            repository.load().getOrThrow()
            assertTrue(repository.save(update).isFailure)
            assertEquals("new-offer", repository.save(update).getOrThrow().id)
            assertRequests(server,
                "GET /api/users/quiet-fox",
                "GET /api/offers-by/member-one?types=host",
                "POST /api/offers",
                "GET /api/offers-by/member-one?types=host",
                "POST /api/offers",
            )
        }
    }

    @Test
    fun retryWithoutALoadedMemberDoesNotAttemptAnotherNetworkWrite() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(code = 502, body = "{}"))
            val repository = repository(server)

            assertEquals(502, (repository.save(update).exceptionOrNull() as MobileApiException).statusCode)
            assertTrue(repository.save(update).isFailure)
            assertRequests(server, "POST /api/offers")
        }
    }

    @Test
    fun loadingAnOldOfferLeavesMissingCoordinatesAndUnknownMeetingStatusUnset() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(profile())
            server.enqueue(MockResponse(body = """[{"_id":"old-offer","meetingStatus":"retired"}]"""))
            val offer = repository(server).load().getOrThrow()

            assertEquals("old-offer", offer.id)
            assertEquals("", offer.latitude)
            assertEquals("", offer.longitude)
            assertFalse(offer.locationValid)
            assertEquals("not-set", offer.meetingStatus)
        }
    }

    @Test
    fun savingALoadedOfferUpdatesItsIdAndRetainsItsLocationAndMeetingStatus() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(profile())
            server.enqueue(MockResponse(body = """[{"_id":"existing-offer","location":[41.1,-8.5],"meetingStatus":"maybe"}]"""))
            server.enqueue(MockResponse(body = """{"message":"Saved"}"""))
            val repository = repository(server)

            val offer = repository.load().getOrThrow()

            assertEquals("41.1", offer.latitude)
            assertEquals("-8.5", offer.longitude)
            assertEquals("maybe", offer.meetingStatus)
            assertEquals("existing-offer", repository.save(offer.toUpdate()).getOrThrow().id)
            assertRequests(server,
                "GET /api/users/quiet-fox",
                "GET /api/offers-by/member-one?types=host",
                "PUT /api/offers/existing-offer",
            )
        }
    }

    private fun profile() = MockResponse(body = """{"_id":"member-one","username":"quiet-fox"}""")

    private fun repository(server: MockWebServer): MobileApiHostOfferRepository {
        server.start()
        return MobileApiHostOfferRepository(
            MobileApiClient(server.url("/").toString()),
            MemberSession("connect.sid=fictional", MobileMember("quiet-fox", "Quiet Fox")),
            descriptionDecoder = HostOfferDescriptionDecoder { it.orEmpty() },
        )
    }

    private fun assertRequests(server: MockWebServer, vararg expected: String) {
        val actual = List(expected.size) {
            val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
            "${request.method} ${request.target}"
        }
        assertEquals(expected.toList(), actual)
        assertEquals(expected.size, server.requestCount)
    }
}
