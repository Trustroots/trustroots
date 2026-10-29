package org.trustroots.android.ui.hostmap

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MobileHostMapRepositoryFiltersTest {
    @Test fun translatesHostAndMeetSelectionsAndRejectsAnEmptySelectionWithoutARequest() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = MobileHostMapRepository(
                MobileApiClient(server.url("/").toString()),
                MemberSession("connect.sid=fictional-map-session", MobileMember("quiet-heron", "Quiet Heron")),
                RuntimeEnvironment.getApplication(),
            )
            val bounds = MapBounds(south = 1.0, west = 2.0, north = 3.0, east = 4.0)

            for (types in listOf(setOf("host"), setOf("meet"), setOf("host", "meet"))) {
                server.enqueue(MockResponse(code = 200, body = "{\"features\":[]}"))
                val result = repository.searchOffers(bounds, HostMapFilters(
                    includeHosts = "host" in types,
                    includeMeet = "meet" in types,
                ))

                assertTrue(result.getOrThrow().isEmpty())
                val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
                val filters = JSONObject(requireNotNull(request.url.queryParameter("filters")))
                val actual = filters.getJSONArray("types")
                assertEquals(types.sorted(), List(actual.length()) { actual.getString(it) })
            }

            val invalid = repository.searchOffers(bounds, HostMapFilters(includeHosts = false, includeMeet = false))
            assertTrue(invalid.exceptionOrNull() is IllegalArgumentException)
            assertEquals(3, server.requestCount)
        }
    }
}
