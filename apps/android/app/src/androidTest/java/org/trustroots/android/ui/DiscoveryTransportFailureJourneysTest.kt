package org.trustroots.android.ui

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class DiscoveryTransportFailureJourneysTest {
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

    @Test fun hostMapSearchTransportFailureStopsLoadingAndRecoversOnFilterChange() {
        val offersRequests = AtomicInteger()
        val allowRecovery = AtomicBoolean(false)
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") -> {
                    offersRequests.incrementAndGet()
                    if (allowRecovery.get()) {
                        LocalTransportFixture.Response(
                            """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[30.25,12.5]}}]}""",
                        )
                    } else {
                        null
                    }
                }
                request.method == "GET" && request.path.startsWith("/api/tribes?") ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        val invalidations = AtomicInteger()
        val offlineMapViewFactory: (Context) -> MapView = { context ->
            MapView(context).apply { setUseDataConnection(false) }
        }

        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = session(),
                onSessionInvalidated = { invalidations.incrementAndGet() },
                geocoderLookup = { _, _, _ -> emptyList() },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        awaitMapTransportError(local)
        compose.onNodeWithTag("mapStatistics").assertIsDisplayed()
        compose.onNodeWithText("0 offers · 0 Nostroots notes in this area").assertIsDisplayed()
        assertEquals(0, invalidations.get())

        val failedAttempts = offersRequests.get()
        allowRecovery.set(true)
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.waitUntil(10_000) {
            offersRequests.get() > failedAttempts &&
                compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("1 offers · 0 Nostroots notes in this area").assertIsDisplayed()
        assertTrue(local.requests.count { it.path.startsWith("/api/offers?") } > failedAttempts)
        assertEquals(0, invalidations.get())
    }

    @Test fun circlesTransportFailureEndsLoadingAndKeepsDiscoveryScreenAvailable() {
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/tribes?limit=150" -> null
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
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

        awaitTransportError(
            local,
            setOf(
                "Discover circles",
                "Joining circles helps you find likeminded Trustroots members.",
                "Filter circles",
            ),
        )
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        assertTrue(local.requests.any { it.path == "/api/tribes?limit=150" })
        assertTrue(local.requests.any { it.path == "/api/users/memberships" })
        assertEquals(0, invalidations.get())
    }

    private fun startFixture(
        respond: (LocalTransportFixture.Request) -> LocalTransportFixture.Response?,
    ): LocalTransportFixture = LocalTransportFixture(respond).also { fixture = it }

    private fun awaitMapTransportError(local: LocalTransportFixture) {
        compose.waitUntil(10_000) {
            val idle = compose.onAllNodesWithText("0 offers · 0 Nostroots notes in this area")
                .fetchSemanticsNodes().isNotEmpty()
            val error = compose.onAllNodes(
                SemanticsMatcher("non-empty text outside the map's fixed labels") { node ->
                    node.config.contains(SemanticsProperties.Text) &&
                        node.config[SemanticsProperties.Text].any { it.text.isNotBlank() && it.text !in MAP_LABELS }
                },
            ).fetchSemanticsNodes().isNotEmpty()
            idle && error && local.requests.any { it.path.startsWith("/api/offers?") }
        }
    }

    private fun awaitTransportError(local: LocalTransportFixture, knownLabels: Set<String>) {
        compose.waitUntil(10_000) {
            val loading = compose.onAllNodes(
                SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo),
            ).fetchSemanticsNodes().isNotEmpty()
            val error = compose.onAllNodes(
                SemanticsMatcher("non-empty text outside the screen's fixed labels") { node ->
                    node.config.contains(SemanticsProperties.Text) &&
                        node.config[SemanticsProperties.Text].any { it.text.isNotBlank() && it.text !in knownLabels }
                },
            ).fetchSemanticsNodes().isNotEmpty()
            !loading && error && local.requests.any { it.path == "/api/tribes?limit=150" }
        }
    }

    private fun session() = MemberSession(
        "connect.sid=fictional-discovery-session",
        MobileMember("steady-heron", "Steady Heron"),
    )

    private companion object {
        val MAP_LABELS = setOf(
            "Search places",
            "Hosting",
            "Meet",
            "Last active: 6 months",
            "0 offers · 0 Nostroots notes in this area",
            "Searching this area…",
            "© OpenStreetMap contributors",
            "© Mapbox · © OpenStreetMap contributors",
        )
    }
}
