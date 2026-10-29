package org.trustroots.android.ui

import android.location.Address
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Locale
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapNotesConnection
import org.trustroots.android.ui.search.SearchHubScreen

@RunWith(AndroidJUnit4::class)
class HostDetailUnderlaySearchModeJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun changingSearchModeThroughExposedMapHeaderKeepsHostDetailOnBackStack() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response(
                        """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}""",
                    )
                request.method == "GET" && request.path == "/api/offers/offer-one" ->
                    LocalTransportFixture.Response(
                        """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","maxGuests":2,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}""",
                    )
                request.method == "GET" && request.path.startsWith("/api/nostr/author-visibility?") ->
                    LocalTransportFixture.Response("""{"linkedPubkeys":[],"pubkeys":[]}""")
                request.method == "GET" && request.path.startsWith("/api/users/memberships") ->
                    LocalTransportFixture.Response("[]")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> LocalTransportFixture.Response("[]")
            }
        }.also { fixture = it }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional-search-session", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    geocoderLookup = { _, _, _ ->
                        listOf(Address(Locale.UK).apply {
                            latitude = 38.7223
                            longitude = -9.1393
                            setAddressLine(0, "Fictional destination")
                        })
                    },
                    notesClientFactory = { _, _ -> HostMapNotesConnection {} },
                    mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false) } },
                )
            }
        }

        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offer · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional spare room.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("hostDetailRoute", useUnmergedTree = true).assertIsDisplayed()

        // The host preview occupies the lower portion of the screen; tap the actual
        // exposed search-mode control through Compose's pointer dispatch.
        compose.onNodeWithContentDescription("Search mode").performTouchInput { click(center) }
        compose.onNodeWithText("Members").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Find a member").fetchSemanticsNodes().isNotEmpty()
        }
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Find a member").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("A fictional spare room.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("hostDetailRoute", useUnmergedTree = true).assertIsDisplayed()
    }
}
