package org.trustroots.android.ui

import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText

import android.content.Context
import android.content.res.Configuration
import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
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
import java.util.concurrent.atomic.AtomicBoolean
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
        compose.onNodeWithText("Might meet").assertIsDisplayed()
        compose.onNodeWithText("Offers volunteering").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android-map-current-area-results")
        compose.onNodeWithTag("map-result-offer-one").performClick()
        waitForTag("hostDetailRoute")
        val detailMeetingBadge = hasText("Might meet").and(hasAnyAncestor(hasTestTag("hostDetailRoute")))
        compose.waitUntil(10_000) { compose.onAllNodes(detailMeetingBadge).fetchSemanticsNodes().isNotEmpty() }
        compose.onNode(detailMeetingBadge).assertIsDisplayed()
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

    @Test fun narrowShortResultsWithLargerTextKeepOffersAndReturnNavigationUsable() {
        val local = apiFixture()
        showMap(local, compactLargeText = true)
        waitForText("1 offer · 0 Nostroots notes in this area")
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithTag("mapResultsToggle").assertIsDisplayed().performClick()
        compose.onNodeWithText("Back to map").assertIsDisplayed()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        compose.onNodeWithContentDescription("Show filters").assertIsDisplayed()
        compose.onNodeWithText("Back to map").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android-map-narrow-large-text-results")
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithTag("map-result-offer-one").performClick()
        waitForTag("hostDetailRoute")
        compose.onNodeWithContentDescription("Close host result").assertIsDisplayed().performClick()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithTag("mapResultsToggle").assertIsDisplayed().performClick()
        compose.onNodeWithContentDescription("Hide filters").assertIsDisplayed()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
        // A deliberately collapsed map also stays collapsed after inspecting Results.
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithTag("mapResultsToggle").assertIsDisplayed().performClick()
        waitForText("Quiet Fox")
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithContentDescription("Show filters").assertIsDisplayed()
        compose.onNodeWithText("Hosting").assertDoesNotExist()
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
        compose.onNodeWithTag("openFilters").performClick()
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
        val local = apiFixture { request ->
            when (request.path) {
                "/api/offers/offer-one" -> LocalTransportFixture.Response(
                    """{"_id":"offer-one","status":"yes","user":{"username":"quiet-fox","displayName":"Quiet Fox"}}""",
                )
                "/api/offers/offer-two" -> LocalTransportFixture.Response(
                    """{"_id":"offer-two","status":"maybe","meetingStatus":"yes","user":{"username":"amber-owl","displayName":"Amber Owl"}}""",
                )
                else -> null
            }
        }
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
        compose.onNodeWithText("Happy to meet").assertIsDisplayed()
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

    @Test fun resultsRetryReloadsFailedCirclesWithoutRepeatingTheHostSearch() {
        val failCircles = AtomicBoolean(false)
        val circleReads = AtomicInteger()
        val local = apiFixture { request ->
            if (request.path.startsWith("/api/tribes?")) {
                circleReads.incrementAndGet()
                when {
                    failCircles.get() -> LocalTransportFixture.Response(
                        """{"message":"Fictional circles temporarily unavailable."}""", status = 503,
                    )
                    circleReads.get() >= 3 -> LocalTransportFixture.Response(
                        """[{"_id":"circle-one","slug":"ready-circle","label":"Ready Circle"}]""",
                    )
                    else -> LocalTransportFixture.Response("[]")
                }
            } else null
        }
        showMap(local)
        waitForText("1 offer · 0 Nostroots notes in this area")
        compose.waitUntil(10_000) { circleReads.get() == 1 }
        compose.onNodeWithTag("mapResultsToggle").performClick()
        failCircles.set(true)
        compose.onNodeWithTag("openFilters").performClick()
        waitForText("Fictional circles temporarily unavailable.")
        compose.onNodeWithTag("openFilters").performClick()
        val hostReads = local.requests.count { it.path.startsWith("/api/offers?") }
        failCircles.set(false)
        compose.onNodeWithText("Retry").performClick()
        compose.waitUntil(10_000) {
            circleReads.get() == 3 && compose.onAllNodesWithText("Retry").fetchSemanticsNodes().isEmpty()
        }
        assertEquals(hostReads, local.requests.count { it.path.startsWith("/api/offers?") })
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("All circles").performClick()
        waitForText("Ready Circle")
        assertEquals(3, circleReads.get())
        assertEquals(0, invalidations.get())
    }

    @Test fun resultsRetryRepeatsAnOrdinaryFailedHostSearch() {
        val hostReads = AtomicInteger()
        val local = apiFixture { request ->
            if (request.path.startsWith("/api/offers?") && hostReads.incrementAndGet() == 1) {
                LocalTransportFixture.Response("""{"message":"Fictional host search unavailable."}""", status = 503)
            } else null
        }
        showMap(local)
        waitForText("Fictional host search unavailable.")
        compose.onNodeWithTag("mapResultsToggle").performClick()
        compose.onNodeWithText("Retry").performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Fictional host search unavailable.").assertDoesNotExist()
        assertEquals(2, hostReads.get())
        assertEquals(0, invalidations.get())
    }

    @Test fun multipleExpiredVisibleOffersInvalidateTheSessionOnlyOnce() {
        val local = apiFixture { request ->
            if (request.path in setOf("/api/offers/offer-one", "/api/offers/offer-two")) {
                LocalTransportFixture.Response("{}", status = 401)
            } else null
        }
        compose.setContent {
            TrustrootsTheme {
                HostMapResults(
                    offers = listOf(MapOffer("offer-one", 0.0, 0.0), MapOffer("offer-two", 0.0, 0.0)),
                    loading = false, failure = null, api = MobileApiClient(local.baseURL), session = session,
                    onRetrySearch = {}, onOpenOffer = {}, onSessionInvalidated = { invalidations.incrementAndGet() },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("map-result-retry-offer-one").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("map-result-retry-offer-two").fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitForIdle()
        assertEquals(1, invalidations.get())
        assertEquals(2, local.requests.count { it.path.startsWith("/api/offers/") })
        assertTrue(local.requests.all { it.cookie == session.cookieHeader })
    }

    private fun showMap(
        local: LocalTransportFixture,
        compactLargeText: Boolean = false,
        geocoderLookup: (Context, String, Int) -> List<Address>? = { _, _, _ -> emptyList() },
    ) {
        compose.setContent {
            val density = LocalDensity.current
            val configuration = LocalConfiguration.current
            val fixtureConfiguration = if (compactLargeText) Configuration(configuration).apply {
                fontScale = 1.3f; screenWidthDp = 320; screenHeightDp = 520
            } else configuration
            CompositionLocalProvider(
                LocalDensity provides Density(density.density, if (compactLargeText) 1.3f else density.fontScale),
                LocalConfiguration provides fixtureConfiguration,
            ) {
                Box(if (compactLargeText) Modifier.requiredSize(320.dp, 520.dp) else Modifier.fillMaxSize()) {
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
        }
    }

    private fun apiFixture(overrideResponse: (LocalTransportFixture.Request) -> LocalTransportFixture.Response? = { null }): LocalTransportFixture {
        val local = LocalTransportFixture { request ->
            overrideResponse(request) ?: when {
                request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response(
                    """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}""",
                )
                request.path == "/api/offers/offer-one" -> LocalTransportFixture.Response(
                    """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","meetingStatus":"maybe","volunteering":true,"user":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}""",
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
