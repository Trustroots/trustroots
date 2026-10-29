package org.trustroots.android.ui

import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapScreen

@RunWith(AndroidJUnit4::class)
class HostMapKeyboardSuggestionJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun selectingSuggestionHidesTheAvailableKeyboardAndMovesTheMap() {
        val keyboardAvailable = AtomicBoolean(false)
        LocalTransportFixture { request ->
            when {
                request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response("{\"features\":[]}")
                request.path == "/api/tribes?limit=150" || request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("[]")
            }
        }.use { fixture ->
            compose.setContent {
                val keyboard = LocalSoftwareKeyboardController.current
                SideEffect { keyboardAvailable.set(keyboard != null) }
                HostMapScreen(
                    api = MobileApiClient(fixture.baseURL),
                    session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    geocoderLookup = { _, query, _ ->
                        if (query == "Fictional Harbour") {
                            listOf(
                                address("Fictional Harbour West", 40.0, -8.0),
                                address("Fictional Harbour East", 40.7128, -74.0060),
                            )
                        } else emptyList()
                    },
                    mapViewFactory = { context ->
                        org.osmdroid.views.MapView(context).apply { setUseDataConnection(false) }
                    },
                )
            }

            compose.waitUntil(15_000) { fixture.requests.any { it.path.startsWith("/api/offers?") } }
            assertTrue("The Android host should provide a keyboard controller", keyboardAvailable.get())
            compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Fictional Harbour East").fetchSemanticsNodes().isNotEmpty()
            }

            compose.onNodeWithText("Fictional Harbour East").assertIsDisplayed().performClick()

            compose.waitUntil(15_000) {
                fixture.requests.any { request ->
                    request.path.startsWith("/api/offers?") && request.pathContainsBounds(40.7128, -74.0060)
                }
            }
            compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
        }
    }

    private fun address(label: String, latitude: Double, longitude: Double) = Address(Locale.US).apply {
        this.latitude = latitude
        this.longitude = longitude
        setAddressLine(0, label)
    }

    private fun LocalTransportFixture.Request.pathContainsBounds(latitude: Double, longitude: Double): Boolean {
        fun value(name: String): Double? = Regex("(?:[?&])$name=([^& ]+)")
            .find(path)?.groupValues?.get(1)?.toDoubleOrNull()
        val south = value("southWestLat") ?: return false
        val west = value("southWestLng") ?: return false
        val north = value("northEastLat") ?: return false
        val east = value("northEastLng") ?: return false
        return south < latitude && north > latitude && west < longitude && east > longitude
    }
}
