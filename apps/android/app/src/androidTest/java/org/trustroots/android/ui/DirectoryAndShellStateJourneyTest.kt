package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.osmdroid.util.GeoPoint
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CircleDirectoryAuthenticationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val session = MemberSession(
        "connect.sid=fictional-directory-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun directoryAuthenticationFailureInvalidatesSessionAfterMembershipsLoad() {
        val invalidations = AtomicInteger()
        val membershipResponses = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response(
                        """{"message":"Please sign in again."}""",
                        status = 401,
                    )
                request.method == "GET" && request.path == "/api/users/memberships" -> {
                    membershipResponses.incrementAndGet()
                    LocalTransportFixture.Response("[]")
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = local

        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }

        compose.waitUntil(10_000) {
            invalidations.get() == 1 &&
                membershipResponses.get() == 1 &&
                local.requests.any { it.path == "/api/tribes?limit=150" }
        }

        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.waitUntil(5_000) {
            compose.onAllNodes(hasProgressBarRangeInfo(androidx.compose.ui.semantics.ProgressBarRangeInfo.Indeterminate))
                .fetchSemanticsNodes().isEmpty()
        }
        assertEquals(1, invalidations.get())
        assertEquals(1, local.requests.count { it.path == "/api/tribes?limit=150" })
        assertEquals(1, local.requests.count { it.path == "/api/users/memberships" })
        assertTrue(local.requests.all { it.cookie == session.cookieHeader })
    }
}

@RunWith(AndroidJUnit4::class)
class MapOfferAuxiliaryLoadFailureJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val session = MemberSession(
        "connect.sid=fictional-map-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun failedProfileLookupKeepsOfferUsableAndContinuesMembershipLoading() {
        val invalidations = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response(OFFER_SEARCH)
                request.method == "GET" && request.path == "/api/offers/offer-one" ->
                    LocalTransportFixture.Response(HOST_OFFER)
                request.method == "GET" && request.path == "/api/users/quiet-fox" -> {
                    LocalTransportFixture.Response("""{"message":"Profile service unavailable."}""", 503)
                }
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = local
        val mapViewReference = java.util.concurrent.atomic.AtomicReference<MapView?>()
        val offlineMapViewFactory: (Context) -> MapView = { context ->
            MapView(context).apply {
                setUseDataConnection(false)
                mapViewReference.set(this)
            }
        }

        compose.setContent {
            TrustrootsTheme {
                HostMapScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    geocoderLookup = { _, _, _ -> emptyList() },
                    mapViewFactory = offlineMapViewFactory,
                )
            }
        }

        compose.waitUntil(15_000) {
            local.requests.any { it.method == "GET" && it.path.startsWith("/api/offers?") } &&
                mapViewReference.get()?.let { it.width > 0 && it.height > 0 } == true
        }
        compose.runOnUiThread {
            requireNotNull(mapViewReference.get()).controller.setCenter(GeoPoint(30.25, 12.5))
        }
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(15_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/users/memberships" } &&
                compose.onAllNodesWithText("A fictional spare room.").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        compose.onNodeWithTag("openFilters").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/tribes?limit=150" }
        }
        assertTrue(local.requests.any { it.path == "/api/offers/offer-one" })
        assertTrue(local.requests.any { it.path == "/api/users/quiet-fox" })
        assertTrue(local.requests.any { it.path == "/api/users/memberships" })
        assertEquals(0, invalidations.get())
        assertTrue(local.requests.all { it.cookie == session.cookieHeader })
    }

    private companion object {
        const val OFFER_SEARCH = """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[12.5,30.25]}}]}"""
        const val HOST_OFFER = """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","maxGuests":2,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
    }
}

@RunWith(AndroidJUnit4::class)
class ShellUnreadBadgeJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private val session = MemberSession(
        "connect.sid=fictional-shell-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private var previousSessionPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousAlertPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousDestination: MessageDestination? = null
    private var previousAlertStatus: String? = null
    private var fixture: LocalTransportFixture? = null

    @org.junit.Before fun saveAndIsolateSessionState() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousAlertStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After fun restoreStateAndCloseFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            try {
                fixture?.close()
                fixture = null
            } finally {
                restorePreferences(sessionPreferences, previousSessionPreferences)
                restorePreferences(alertPreferences, previousAlertPreferences)
                MessageAlerts.destination.value = previousDestination
                MessageAlerts.status.value = previousAlertStatus
            }
        }
    }

    @Test fun shellBadgeCountsOnlyUnreadConversation() {
        val inboxResponses = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
                    )
                request.method == "GET" && request.path == "/api/messages?page=1&limit=50" -> {
                    inboxResponses.incrementAndGet()
                    LocalTransportFixture.Response(INBOX)
                }
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = local
        SecureMobileSessionStore(context).save(session)

        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = local.baseURL,
                    reconcileAlerts = { _, _ -> },
                )
            }
        }

        compose.waitUntil(15_000) {
            inboxResponses.get() > 0 &&
                compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("1", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("navigation-messages").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "1 unread conversation"),
        )
        compose.onNodeWithText("1", useUnmergedTree = true).assertIsDisplayed()
        assertEquals(1, local.requests.count { it.path == "/api/messages?page=1&limit=50" })
        assertTrue(local.requests.all { it.cookie == session.cookieHeader })
    }
}

private fun restorePreferences(preferences: SharedPreferences, values: Map<String, *>) {
    preferences.edit().clear().commit()
    val editor = preferences.edit()
    values.forEach { (key, value) ->
        when (value) {
            is String -> editor.putString(key, value)
            is Boolean -> editor.putBoolean(key, value)
            is Int -> editor.putInt(key, value)
            is Long -> editor.putLong(key, value)
            is Float -> editor.putFloat(key, value)
            is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
        }
    }
    editor.commit()
}

private const val INBOX = """[
    {"_id":"thread-fox","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional hello."},"read":false},
    {"_id":"thread-owl","userFrom":{"_id":"member-owl","username":"amber-owl","displayName":"Amber Owl"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional update."},"read":true}
]"""
