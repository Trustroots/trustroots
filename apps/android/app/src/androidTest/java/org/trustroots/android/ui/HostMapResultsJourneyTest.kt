package org.trustroots.android.ui

import android.content.Context
import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.URLDecoder
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.testing.pressBackFromNonActivityRoot
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.hostmap.HostMapResults
import org.trustroots.android.ui.hostmap.HostMapScreen
import org.trustroots.android.ui.search.SearchHubScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HostMapResultsJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null
    private val session = MemberSession("connect.sid=fictional-area-session", MobileMember("steady-heron", "Steady Heron"))
    private val map = AtomicReference<MapView?>()
    private val invalidations = AtomicInteger()

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun expandedWrappingFiltersAndAreaResultsKeepTheirMapWhenInspectingAHost() {
        val local = apiFixture()
        showMap(local)
        waitForTag("mapStatistics")
        compose.waitUntil(15_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithText("Meet").assertIsDisplayed()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
        compose.onNodeWithText("All circles").assertIsDisplayed()
        compose.onNodeWithText("Spoken languages").assertIsDisplayed()
        assertTrue(local.requests.filter { it.path.startsWith("/api/offers?") }.all {
            URLDecoder.decode(it.path, "UTF-8").contains("\"seen\":{\"months\":6}")
        })
        captureUsabilityScreenshot(compose, "android-map-expanded-wrapping-filters")
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertDoesNotExist()
        captureUsabilityScreenshot(compose, "android-map-collapsed-filters")
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()

        assertTrue("Offer details are only requested when Results opens", local.requests.none { it.path == "/api/offers/offer-one" })
        val viewport = requireNotNull(map.get()).let { Triple(it.mapCenter.latitude, it.mapCenter.longitude, it.zoomLevelDouble) }
        compose.onNodeWithTag("mapResultsToggle").performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android-map-current-area-results")
        compose.onNodeWithTag("map-result-offer-one").performClick()
        waitForTag("hostDetailRoute")
        compose.onNodeWithContentDescription("Close host result").performClick()
        waitForTag("hostMapResults")
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithTag("hostMapResults").assertDoesNotExist()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithTag("mapResultsToggle").performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithTag("mapResultsToggle").performClick()
        compose.onNodeWithTag("hostMapResults").assertDoesNotExist()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
        compose.runOnIdle {
            val restored = requireNotNull(map.get())
            assertEquals(viewport.first, restored.mapCenter.latitude, 0.00001)
            assertEquals(viewport.second, restored.mapCenter.longitude, 0.00001)
            assertEquals(viewport.third, restored.zoomLevelDouble, 0.001)
        }
        assertEquals(0, invalidations.get())
    }

    @Test fun retriesAnUnavailableListOfferAndShowsEmptyResultsWhenHostingIsDisabled() {
        val attempts = AtomicInteger()
        val local = apiFixture { request ->
            if (request.path == "/api/offers/offer-one" && attempts.incrementAndGet() == 1) {
                LocalTransportFixture.Response("""{"message":"Fictional offer temporarily unavailable."}""", status = 503)
            } else null
        }
        showMap(local)
        compose.waitUntil(15_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithTag("mapResultsToggle").performClick()
        waitForText("Fictional offer temporarily unavailable.")
        compose.onNodeWithTag("map-result-retry-offer-one").performClick()
        waitForText("Quiet Fox")
        assertEquals(2, attempts.get())
        compose.onNodeWithText("Hosting").performClick()
        compose.onNodeWithText("No offers in this area. Try changing the filters or moving the map.").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertDoesNotExist()
        captureUsabilityScreenshot(compose, "android-map-empty-area-results")
    }

    @Test fun anExpiredListOfferRequestInvalidatesTheCurrentSession() {
        val local = apiFixture { request ->
            if (request.path == "/api/offers/offer-one") LocalTransportFixture.Response("{}", status = 401) else null
        }
        showMap(local)
        compose.waitUntil(15_000) { local.requests.any { it.path.startsWith("/api/offers?") } }
        compose.onNodeWithTag("mapResultsToggle").performClick()
        compose.waitUntil(10_000) { invalidations.get() == 1 }
        assertTrue(local.requests.filter { it.path == "/api/offers/offer-one" }.all { it.cookie == session.cookieHeader })
    }

    @Test fun resultListShowsSearchProgressRetryAndMeetingAndMaybeAvailability() {
        val local = apiFixture()
        val loading = mutableStateOf(true)
        val failure = mutableStateOf<UiFailure?>(null)
        val offers = mutableStateOf(emptyList<MapOffer>())
        val retries = AtomicInteger()
        val selected = AtomicReference<MapOffer?>()
        compose.setContent {
            TrustrootsTheme {
                HostMapResults(
                    offers = offers.value,
                    loading = loading.value,
                    failure = failure.value,
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onRetrySearch = { retries.incrementAndGet() },
                    onOpenOffer = { selected.set(it) },
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        compose.onNodeWithTag("mapResultsLoading").assertIsDisplayed()
        compose.runOnIdle { loading.value = false; failure.value = UiFailure(fallback = UiFailureFallback.HOST_SEARCH) }
        compose.onNodeWithText("Retry").performClick()
        assertEquals(1, retries.get())
        compose.runOnIdle {
            failure.value = null
            offers.value = listOf(
                MapOffer("offer-one", 0.0, 0.0, type = "meet"),
                MapOffer("offer-two", 0.0, 0.0, status = "yes"),
                MapOffer("offer-three", 0.0, 0.0, status = "yes"),
            )
        }
        waitForText("Available to meet")
        compose.onNodeWithTag("hostMapResults").performScrollToNode(androidx.compose.ui.test.hasText("Maybe hosting"))
        compose.onNodeWithText("Maybe hosting").assertIsDisplayed()
        compose.onNodeWithTag("map-result-offer-two").performClick()
        assertEquals("offer-two", selected.get()?.id)
        compose.onNodeWithTag("hostMapResults").performScrollToNode(androidx.compose.ui.test.hasText("Not hosting currently"))
        compose.onNodeWithText("Not hosting currently").assertIsDisplayed()
        compose.onNodeWithText("A fictional room that is no longer available.").assertDoesNotExist()
    }

    @Test fun replacingTheSessionDiscardsAnInFlightOfferFromThePreviousMember() {
        val release = CountDownLatch(1)
        val entered = CountDownLatch(1)
        val local = apiFixture { request ->
            if (request.path == "/api/offers/offer-one" && request.cookie == session.cookieHeader) {
                entered.countDown()
                check(release.await(10, TimeUnit.SECONDS))
                LocalTransportFixture.Response(
                    """{"_id":"offer-one","status":"yes","user":{"username":"quiet-fox","displayName":"Quiet Fox"}}""",
                )
            } else if (request.path == "/api/offers/offer-one") {
                LocalTransportFixture.Response(
                    """{"_id":"offer-one","status":"yes","user":{"username":"amber-owl","displayName":"Amber Owl"}}""",
                )
            } else null
        }
        val activeSession = mutableStateOf(session)
        compose.setContent {
            TrustrootsTheme {
                HostMapResults(
                    offers = listOf(MapOffer("offer-one", 0.0, 0.0)), loading = false, failure = null,
                    api = MobileApiClient(local.baseURL), session = activeSession.value,
                    onRetrySearch = {}, onOpenOffer = {}, onSessionInvalidated = {},
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        try {
            compose.waitUntil(10_000) { entered.count == 0L }
            compose.onNodeWithText("Loading offer…").assertIsDisplayed()
            compose.runOnIdle {
                activeSession.value = MemberSession("connect.sid=second-fictional-session", MobileMember("gentle-hare", "Gentle Hare"))
            }
            release.countDown()
            waitForText("Amber Owl")
            compose.onNodeWithText("Quiet Fox").assertDoesNotExist()
            assertTrue(local.requests.any { it.path == "/api/offers/offer-one" && it.cookie == "connect.sid=second-fictional-session" })
        } finally {
            release.countDown()
        }
    }

    @Test fun retryInResultsRepeatsTheFailedPlaceLookupBeforeMovingTheMap() {
        val lookups = AtomicInteger()
        val local = apiFixture()
        showMap(local) { _, _, maxResults ->
            if (maxResults != 1 || lookups.incrementAndGet() == 1) emptyList()
            else listOf(Address(Locale.UK).apply {
                latitude = 45.0; longitude = 1.0
                setAddressLine(0, "Fictional Harbour")
            })
        }
        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
        compose.onNodeWithTag("submittedSearchButton").performClick()
        compose.waitUntil(10_000) { lookups.get() == 1 }
        hideTestKeyboard()
        compose.onNodeWithTag("mapResultsToggle").performClick()
        waitForText("Retry")
        compose.onNodeWithText("Retry").performClick()
        compose.waitUntil(15_000) {
            lookups.get() == 2 && map.get()?.mapCenter?.latitude?.let { kotlin.math.abs(it - 45.0) < 0.01 } == true
        }
        compose.onNodeWithText("Retry").assertDoesNotExist()
        compose.onNodeWithTag("hostMapResults").assertIsDisplayed()
    }

    @Test fun visibleCircleFiltersReloadWhenTheMemberSessionChanges() {
        val local = apiFixture { request ->
            if (request.path.startsWith("/api/tribes?")) {
                val label = if (request.cookie == session.cookieHeader) "Quiet Circle" else "Amber Circle"
                LocalTransportFixture.Response("""[{"_id":"circle-one","slug":"fictional-circle","label":"$label"}]""")
            } else null
        }
        val activeSession = mutableStateOf(session)
        val api = MobileApiClient(local.baseURL)
        compose.setContent {
            TrustrootsTheme {
                HostMapScreen(
                    api = api, session = activeSession.value, onSessionInvalidated = {},
                    geocoderLookup = { _, _, _ -> emptyList() },
                    notesClientFactory = { _, _ -> org.trustroots.android.ui.hostmap.HostMapNotesConnection {} },
                    mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false) } },
                )
            }
        }
        compose.waitUntil(10_000) { local.requests.any { it.path.startsWith("/api/tribes?") } }
        compose.onNodeWithText("All circles").performClick()
        waitForText("Quiet Circle")
        pressBackFromNonActivityRoot(compose.activity)
        compose.onNodeWithContentDescription("Hide filters").assertIsDisplayed()
        compose.runOnIdle {
            activeSession.value = MemberSession("connect.sid=second-fictional-session", MobileMember("gentle-hare", "Gentle Hare"))
        }
        compose.waitUntil(10_000) {
            local.requests.any { it.path.startsWith("/api/tribes?") && it.cookie == "connect.sid=second-fictional-session" }
        }
        compose.onNodeWithText("All circles").performClick()
        waitForText("Amber Circle")
        compose.onNodeWithText("Quiet Circle").assertDoesNotExist()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
    }

    private fun showMap(
        local: LocalTransportFixture,
        geocoderLookup: (Context, String, Int) -> List<Address>? = { _, _, _ -> emptyList() },
    ) {
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    geocoderLookup = geocoderLookup,
                    notesClientFactory = { _, _ -> org.trustroots.android.ui.hostmap.HostMapNotesConnection {} },
                    mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false); map.set(this) } },
                )
            }
        }
    }

    private fun apiFixture(overrideResponse: (LocalTransportFixture.Request) -> LocalTransportFixture.Response? = { null }): LocalTransportFixture {
        val local = LocalTransportFixture { request ->
            overrideResponse(request) ?: when {
                request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response(
                    """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}""",
                )
                request.path == "/api/offers/offer-one" -> LocalTransportFixture.Response(
                    """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","user":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}""",
                )
                request.path == "/api/offers/offer-two" -> LocalTransportFixture.Response(
                    """{"_id":"offer-two","status":"maybe","user":{"username":"amber-owl","displayName":"Amber Owl"}}""",
                )
                request.path == "/api/offers/offer-three" -> LocalTransportFixture.Response(
                    """{"_id":"offer-three","status":"no","description":"A fictional room that is no longer available.","user":{"username":"resting-robin","displayName":"Resting Robin"}}""",
                )
                request.path.startsWith("/api/users/quiet-fox") -> LocalTransportFixture.Response(
                    """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}""",
                )
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> LocalTransportFixture.Response("[]")
            }
        }
        fixture = local
        return local
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(15_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(15_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
