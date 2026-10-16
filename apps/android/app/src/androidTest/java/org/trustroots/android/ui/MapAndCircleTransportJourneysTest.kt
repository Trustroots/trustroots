package org.trustroots.android.ui

import android.content.Context
import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MapAndCircleTransportJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun hostOfferMarkerTransportFailureCanBeRetried() {
        val allowRecovery = AtomicBoolean(false)
        val detailRequests = AtomicInteger()
        val offersRequests = AtomicInteger()
        val successfulOfferResponses = AtomicInteger()
        val mapReference = AtomicReference<MapView?>()
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") -> {
                    offersRequests.incrementAndGet()
                    successfulOfferResponses.incrementAndGet()
                    LocalTransportFixture.Response(OFFER_FEATURES)
                }
                request.method == "GET" && request.path == "/api/offers/offer-one" -> {
                    detailRequests.incrementAndGet()
                    if (allowRecovery.get()) LocalTransportFixture.Response(HOST_OFFER) else null
                }
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
                    )
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path.startsWith("/api/tribes?") ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        val invalidations = AtomicInteger()
        val offlineMapViewFactory: (Context) -> MapView = { context ->
            MapView(context).apply {
                setUseDataConnection(false)
                mapReference.set(this)
            }
        }

        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = session(),
                onSessionInvalidated = { invalidations.incrementAndGet() },
                geocoderLookup = { _, _, _ -> emptyList<Address>() },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
        compose.runOnUiThread {
            requireNotNull(mapReference.get()).controller.setCenter(GeoPoint(MAP_LATITUDE, MAP_LONGITUDE))
        }
        compose.waitUntil(15_000) {
            offersRequests.get() > 0 &&
                compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }

        tapMapMarker()
        awaitDynamicError(local, MAP_LABELS) { request -> request.path == "/api/offers/offer-one" }
        assertTrue(detailRequests.get() > 0)
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/offers/offer-one" },
            method = "GET",
            cookie = SESSION_COOKIE,
            minimumCount = detailRequests.get(),
        )
        assertEquals(0, invalidations.get())

        val previousSearchCount = offersRequests.get()
        val previousSuccessfulSearches = successfulOfferResponses.get()
        val failedDetailRequestCount = detailRequests.get()
        allowRecovery.set(true)
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.waitUntil(10_000) {
            offersRequests.get() > previousSearchCount &&
                successfulOfferResponses.get() > previousSuccessfulSearches &&
                !hasDynamicText(MAP_LABELS) &&
                compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        tapMapMarker()
        compose.waitUntil(10_000) {
            detailRequests.get() > failedDetailRequestCount &&
                compose.onAllNodesWithText("A fictional spare room.")
                    .fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()
        assertEquals(0, invalidations.get())
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/offers/offer-one" },
            method = "GET",
            cookie = SESSION_COOKIE,
            minimumCount = failedDetailRequestCount + 1,
        )
        assertMatchingRequests(
            local,
            pathMatches = { it.path.startsWith("/api/offers?") },
            method = "GET",
            cookie = SESSION_COOKIE,
            minimumCount = previousSearchCount + 1,
        )
    }

    @Test fun membershipTransportFailureReloadsWhenTheSessionIsRenewed() {
        val allowRecovery = AtomicBoolean(false)
        val membershipsLoads = AtomicInteger()
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response(CIRCLES)
                request.method == "GET" && request.path == "/api/users/memberships" -> {
                    membershipsLoads.incrementAndGet()
                    if (allowRecovery.get()) {
                        LocalTransportFixture.Response("""[{"tribe":{"_id":"circle-one"}}]""")
                    } else {
                        null
                    }
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        val invalidations = AtomicInteger()
        val currentSession = mutableStateOf(session())

        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = currentSession.value,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }

        awaitDynamicError(local, CIRCLE_LABELS) { request -> request.path == "/api/users/memberships" }
        compose.onNodeWithText("Quiet Coast").assertIsDisplayed()
        compose.onNodeWithText("Join").assertIsDisplayed()
        assertTrue(membershipsLoads.get() > 0)
        val failedMembershipLoadCount = membershipsLoads.get()
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/tribes?limit=150" },
            method = "GET",
            cookie = SESSION_COOKIE,
        )
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/users/memberships" },
            method = "GET",
            cookie = SESSION_COOKIE,
            minimumCount = failedMembershipLoadCount,
        )
        assertEquals(0, invalidations.get())

        allowRecovery.set(true)
        compose.runOnUiThread {
            currentSession.value = session("connect.sid=fictional-renewed-session")
        }
        compose.waitUntil(10_000) {
            membershipsLoads.get() > failedMembershipLoadCount &&
                compose.onAllNodesWithText("Joined").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Joined").assertIsDisplayed()
        assertEquals(0, invalidations.get())
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/users/memberships" && it.cookie == RENEWED_SESSION_COOKIE },
            method = "GET",
            cookie = RENEWED_SESSION_COOKIE,
            minimumCount = membershipsLoads.get() - failedMembershipLoadCount,
        )
    }

    @Test fun failedMembershipChangeCanBeRetriedAfterTransportRecovery() {
        val allowRecovery = AtomicBoolean(false)
        val updateRequests = AtomicInteger()
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response(CIRCLES)
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                request.method == "POST" && request.path == "/api/users/memberships/circle-one" -> {
                    updateRequests.incrementAndGet()
                    if (allowRecovery.get()) LocalTransportFixture.Response("{}") else null
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        val invalidations = AtomicInteger()

        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session(),
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/users/memberships" } &&
                compose.onAllNodesWithText("Quiet Coast").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Coast").performClick()
        compose.onNodeWithText("Join circle").performClick()
        awaitDynamicError(local, CIRCLE_DETAIL_LABELS) { request ->
            request.method == "POST" && request.path == "/api/users/memberships/circle-one"
        }
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithText("Join circle").assertIsEnabled() }.isSuccess
        }
        compose.onNodeWithText("Join circle").assertIsDisplayed().assertIsEnabled()
        assertTrue(updateRequests.get() > 0)
        val failedUpdateCount = updateRequests.get()
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/users/memberships/circle-one" },
            method = "POST",
            cookie = SESSION_COOKIE,
            minimumCount = failedUpdateCount,
        )
        assertEquals(0, invalidations.get())

        allowRecovery.set(true)
        compose.onNodeWithText("Join circle").performClick()
        compose.waitUntil(10_000) {
            updateRequests.get() > failedUpdateCount &&
                compose.onAllNodesWithText("Leave circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Leave circle").assertIsDisplayed()
        assertEquals(0, invalidations.get())
        assertMatchingRequests(
            local,
            pathMatches = { it.path == "/api/users/memberships/circle-one" },
            method = "POST",
            cookie = SESSION_COOKIE,
            minimumCount = failedUpdateCount + 1,
        )
    }

    private fun tapMapMarker() {
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
    }

    private fun awaitDynamicError(
        local: LocalTransportFixture,
        knownLabels: Set<String>,
        requestMatches: (LocalTransportFixture.Request) -> Boolean,
    ) {
        compose.waitUntil(10_000) {
            val loading = compose.onAllNodes(
                SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo),
            ).fetchSemanticsNodes().isNotEmpty()
            val dynamicError = compose.onAllNodes(
                SemanticsMatcher("non-empty text outside the screen's fixed labels") { node ->
                    node.config.contains(SemanticsProperties.Text) &&
                        node.config[SemanticsProperties.Text]
                            .any { it.text.isNotBlank() && it.text !in knownLabels }
                },
            ).fetchSemanticsNodes().isNotEmpty()
            !loading && dynamicError && local.requests.any(requestMatches)
        }
    }

    private fun hasDynamicText(knownLabels: Set<String>): Boolean = compose.onAllNodes(
        SemanticsMatcher("non-empty text outside the screen's fixed labels") { node ->
            node.config.contains(SemanticsProperties.Text) &&
                node.config[SemanticsProperties.Text]
                    .any { it.text.isNotBlank() && it.text !in knownLabels }
        },
    ).fetchSemanticsNodes().isNotEmpty()

    private fun assertMatchingRequests(
        local: LocalTransportFixture,
        pathMatches: (LocalTransportFixture.Request) -> Boolean,
        method: String,
        cookie: String,
        minimumCount: Int = 1,
    ) {
        val requests = local.requests.filter(pathMatches)
        assertTrue("Expected at least $minimumCount matching requests", requests.size >= minimumCount)
        assertTrue(requests.all { it.method == method })
        assertTrue(requests.all { it.cookie == cookie })
    }

    private fun startFixture(
        respond: (LocalTransportFixture.Request) -> LocalTransportFixture.Response?,
    ): LocalTransportFixture = LocalTransportFixture(respond).also { fixture = it }

    private fun session(cookie: String = "connect.sid=fictional-discovery-session") = MemberSession(
        cookie,
        MobileMember("steady-heron", "Steady Heron"),
    )

    private companion object {
        const val MAP_LATITUDE = 30.25
        const val MAP_LONGITUDE = 12.5
        const val SESSION_COOKIE = "connect.sid=fictional-discovery-session"
        const val RENEWED_SESSION_COOKIE = "connect.sid=fictional-renewed-session"
        const val OFFER_FEATURES =
            """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[12.5,30.25]}}]}"""
        const val HOST_OFFER =
            """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","maxGuests":1,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
        const val CIRCLES =
            """[{"_id":"circle-one","slug":"quiet-coast","label":"Quiet Coast","count":2,"image":false}]"""
        val CIRCLE_LABELS = setOf(
            "Discover circles",
            "Joining circles helps you find likeminded Trustroots members.",
            "Filter circles",
            "Quiet Coast",
            "2 members",
            "Join",
            "Back",
            "Q",
        )
        val CIRCLE_DETAIL_LABELS = CIRCLE_LABELS + setOf("Join circle", "Leave circle")
        val MAP_LABELS = setOf(
            "Search places",
            "Hosting",
            "Meet",
            "Last active: 6 months",
            "Last active: any time",
            "Last active: 1 month",
            "All circles",
            "Spoken languages",
            "Any language",
            "1 offers · 0 Nostroots notes in this area",
            "Searching this area…",
            "Potential host",
            "© OpenStreetMap contributors",
            "© Mapbox · © OpenStreetMap contributors",
        )
    }
}
