package org.trustroots.android.ui

import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapNotesConnection
import org.trustroots.android.ui.search.SearchHubScreen

@RunWith(AndroidJUnit4::class)
class SearchModeBackNavigationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun backFromMembersReturnsToMapAndBackAtMapLeavesSearch() {
        val rootBack = AtomicBoolean(false)
        LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response("{\"features\":[]}")
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}")
            }
        }.use { fixture ->
            compose.setContent {
                NativeTestAppFrame(Destination.Search) {
                    SearchHubScreen(
                        api = MobileApiClient(fixture.baseURL),
                        session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                        geocoderLookup = { _, _, _ -> emptyList<Address>() },
                        notesClientFactory = { _, _ -> HostMapNotesConnection {} },
                        mapViewFactory = { context ->
                            org.osmdroid.views.MapView(context).apply { setUseDataConnection(false) }
                        },
                        onBackAtRoot = { rootBack.set(true) },
                    )
                }
            }

            compose.waitUntil(15_000) {
                compose.onAllNodesWithText("0 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithContentDescription("Search mode").performClick()
            compose.onNodeWithText("Members").performClick()
            compose.onNodeWithText("Find a member").assertIsDisplayed()

            compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("placeSearchField").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithTag("mapStatistics").assertIsDisplayed()
            compose.onNodeWithText("Find a member").assertDoesNotExist()
            org.junit.Assert.assertFalse("Returning to Map should remain inside Search", rootBack.get())

            compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
            compose.waitUntil(5_000) { rootBack.get() }
        }
    }
}
