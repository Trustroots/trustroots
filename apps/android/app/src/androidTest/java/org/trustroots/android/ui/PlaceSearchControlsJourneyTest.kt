package org.trustroots.android.ui

import android.content.Context
import android.location.Address
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
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
import org.trustroots.android.ui.hostmap.HostMapScreen

@RunWith(AndroidJUnit4::class)
class PlaceSearchControlsJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron"))
    private val mapReference = AtomicReference<MapView?>()

    @Test fun clearingVisibleSuggestionsPreservesMapResultsAndOpenFilters() {
        LocalTransportFixture { request ->
            when {
                request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response(OFFER_FEATURES)
                request.path.startsWith("/api/tribes") -> LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}")
            }
        }.use { fixture ->
            showMap(fixture) { _, query, maxResults ->
                if (query == "Fictional Harbour" && maxResults == 3) {
                    listOf(address("Fictional Harbour, Somewhere", 40.7128, -74.0060))
                } else emptyList()
            }
            waitForInitialResults(fixture)
            val offerRequestsBeforeClear = offerRequestCount(fixture)

            compose.onNodeWithTag("openFilters").performClick()
            compose.onNodeWithText("Hosting").assertIsDisplayed()
            compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
            waitFor("Fictional Harbour, Somewhere")
            hideTestKeyboard()
            val viewportBeforeClear = viewport()

            compose.onNodeWithContentDescription("Clear place search")
                .assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp).performClick()

            compose.onNodeWithText("Fictional Harbour, Somewhere").assertDoesNotExist()
            compose.onNodeWithContentDescription("Clear place search").assertDoesNotExist()
            compose.onNodeWithText("Hosting").assertIsDisplayed()
            compose.onNodeWithText("1 offer · 0 Nostroots notes in this area").assertExists()
            assertEquals(offerRequestsBeforeClear, offerRequestCount(fixture))
            assertEquals("Clearing suggestions must preserve the current viewport", viewportBeforeClear, viewport())
        }
    }

    @Test fun clearingPendingSubmittedLookupIgnoresLateSuccessAndPreservesViewport() =
        clearPendingSubmittedLookup(submitWithKeyboard = false, shouldFail = false)

    @Test fun clearingPendingSubmittedLookupIgnoresLateFailure() =
        clearPendingSubmittedLookup(submitWithKeyboard = true, shouldFail = true)

    private fun clearPendingSubmittedLookup(submitWithKeyboard: Boolean, shouldFail: Boolean) {
        val lookupStarted = CountDownLatch(1)
        val releaseLookup = CountDownLatch(1)
        val lookupFinished = CountDownLatch(1)
        LocalTransportFixture { request ->
            when {
                request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response(OFFER_FEATURES)
                request.path.startsWith("/api/tribes") -> LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}")
            }
        }.use { fixture ->
            try {
                showMap(fixture) { _, _, maxResults ->
                    if (maxResults == 1) {
                        lookupStarted.countDown()
                        try {
                            check(releaseLookup.await(5, TimeUnit.SECONDS)) { "Test did not release the place lookup" }
                            if (shouldFail) throw IllegalStateException("Fictional geocoder failure")
                            listOf(address("Fictional Faraway City", 51.5074, -0.1278))
                        } finally {
                            lookupFinished.countDown()
                        }
                    } else {
                        emptyList()
                    }
                }
                waitForInitialResults(fixture)
                val offerRequestsBeforeSearch = offerRequestCount(fixture)
                val viewportBeforeSearch = viewport()

                compose.onNodeWithTag("placeSearchField").performTextReplacement("ab")
                if (submitWithKeyboard) {
                    compose.onNodeWithTag("placeSearchField").performImeAction()
                } else {
                    compose.onNodeWithContentDescription("Search places")
                        .assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp).performClick()
                }
                assertTrue("Submitted place lookup should start", lookupStarted.await(5, TimeUnit.SECONDS))
                compose.onNodeWithContentDescription("Clear place search")
                    .assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp).performClick()

                assertTrue("Blocked place lookup should complete after release", releaseAndAwait(releaseLookup, lookupFinished))
                compose.waitForIdle()
                compose.onNodeWithContentDescription("Clear place search").assertDoesNotExist()
                compose.onAllNodesWithText("Could not find that place.").assertCountEquals(0)
                compose.onNodeWithText("1 offer · 0 Nostroots notes in this area").assertIsDisplayed()
                assertEquals("Clearing a submitted lookup must not start a map search", offerRequestsBeforeSearch, offerRequestCount(fixture))
                assertEquals("Clearing a submitted lookup must preserve the current viewport", viewportBeforeSearch, viewport())
            } finally {
                releaseLookup.countDown()
            }
        }
    }

    private fun showMap(
        fixture: LocalTransportFixture,
        geocoderLookup: (Context, String, Int) -> List<Address>?,
    ) {
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(fixture.baseURL),
                session = session,
                onSessionInvalidated = {},
                geocoderLookup = geocoderLookup,
                mapViewFactory = { context ->
                    MapView(context).apply {
                        setUseDataConnection(false)
                        mapReference.set(this)
                    }
                },
            )
        }
    }

    private fun waitForInitialResults(fixture: LocalTransportFixture) {
        compose.waitUntil(10_000) {
            offerRequestCount(fixture) > 0 &&
                compose.onAllNodesWithText("1 offer · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
    }

    private fun waitFor(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun offerRequestCount(fixture: LocalTransportFixture): Int =
        fixture.requests.count { it.path.startsWith("/api/offers?") }

    private fun viewport(): Viewport {
        var result = Viewport(0.0, 0.0, 0.0)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val centre = map.mapCenter
            result = Viewport(centre.latitude, centre.longitude, map.zoomLevelDouble)
        }
        return result
    }

    private data class Viewport(val latitude: Double, val longitude: Double, val zoom: Double)

    private fun releaseAndAwait(release: CountDownLatch, finished: CountDownLatch): Boolean {
        release.countDown()
        return finished.await(5, TimeUnit.SECONDS)
    }

    private fun address(label: String, latitude: Double, longitude: Double) =
        Address(Locale.US).apply {
            this.latitude = latitude
            this.longitude = longitude
            setAddressLine(0, label)
        }

    private companion object {
        const val OFFER_FEATURES = """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
    }
}
