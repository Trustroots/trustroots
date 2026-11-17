package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class ProfileHostingJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val saved = AtomicBoolean(false)
    private val fixture = LocalTransportFixture { request ->
        val offer = if (saved.get()) {
            """{"_id":"offer-one","status":"no","noOfferDescription":"Away for now","maxGuests":1}"""
        } else {
            """{"_id":"offer-one","status":"yes","description":"A quiet guest room","maxGuests":1}"""
        }
        val body = when {
            request.method == "PUT" && request.path == "/api/offers/offer-one" -> {
                saved.set(true)
                """{"_id":"offer-one","status":"no","noOfferDescription":"Away for now","maxGuests":1}"""
            }
            request.path == "/api/users/quiet-fox" ->
                """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","languages":[]}"""
            request.path.startsWith("/api/offers-by/") -> "[$offer]"
            else -> "[]"
        }
        LocalTransportFixture.Response(body)
    }

    @After fun closeFixture() = fixture.close()

    @Test fun hostingShortcutCancelsAndReturnsSavedAvailabilityToRetainedProfile() {
        compose.setContent {
            NativeTestAppFrame(Destination.Menu) {
                MemberProfileScreen(
                    api = MobileApiClient(fixture.baseURL),
                    session = MemberSession("fictional-cookie", MobileMember("quiet-fox", "Quiet Fox")),
                    username = "quiet-fox", onSessionInvalidated = {}, onBack = {},
                )
            }
        }
        waitForText("Edit hosting")
        captureUsabilityScreenshot(compose, "android_profile_hosting_shortcut")
        compose.onNodeWithText("Edit hosting").assertIsDisplayed().performClick()
        waitForText("Availability")
        compose.onNodeWithText("No", ignoreCase = true).performClick()
        compose.onNodeWithContentDescription("Cancel").performClick()
        waitForText("Discard changes?")
        compose.onNodeWithText("Discard changes").performClick()
        assertFalse(saved.get())
        waitForText("Edit hosting")
        compose.onNodeWithText("Edit hosting").performClick()
        waitForText("Availability")
        compose.onNodeWithText("No", ignoreCase = true).performClick()
        compose.onNodeWithText("Save changes").performClick()
        waitForText("Hosting offer saved.")
        // Exercise system back as well as toolbar cancellation.
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        waitForText("Edit hosting")
        compose.onNodeWithText("About").performClick()
        waitForText("Not hosting currently")
        compose.onNodeWithText("Not hosting currently").performScrollTo().assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_profile_saved_hosting")
        // The editor loads its own profile twice; returning never reloads the parent's profile.
        assertEquals(3, fixture.requests.count { it.path == "/api/users/quiet-fox" })
        assertEquals(1, fixture.requests.count { it.method == "PUT" && it.path == "/api/offers/offer-one" })
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
