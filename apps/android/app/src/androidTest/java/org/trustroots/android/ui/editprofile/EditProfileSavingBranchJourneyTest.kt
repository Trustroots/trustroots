package org.trustroots.android.ui.editprofile

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.testing.pressBackFromNonActivityRoot
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class EditProfileSavingBranchJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val session = MemberSession(
        "connect.sid=fictional-edit-profile-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val updateArrived = CountDownLatch(1)
    private val allowUpdateResponse = CountDownLatch(1)
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        allowUpdateResponse.countDown()
        fixture?.close()
        fixture = null
    }

    @Test fun savingDisablesEveryProfileEditorControlUntilTheUpdateReturns() {
        val saved = AtomicReference<MemberProfile?>()
        val local = LocalTransportFixture { request ->
            if (request.method == "PUT" && request.path == "/api/users") {
                updateArrived.countDown()
                check(allowUpdateResponse.await(10, TimeUnit.SECONDS)) { "Profile update response was not released" }
                LocalTransportFixture.Response(
                    """{"_id":"fictional-self","username":"steady-heron","displayName":"Updated Heron","tagline":"A brighter fictional journey.","description":"A welcoming fictional place.","locationLiving":"Faro","locationFrom":"Braga","languages":["eng","por"]}""",
                )
            } else {
                LocalTransportFixture.Response("{}", 404)
            }
        }
        fixture = local
        val initial = MemberProfile(
            id = "fictional-self",
            username = session.member.username,
            displayName = "Steady Heron",
            tagline = "A calm fictional journey.",
            description = "A welcoming fictional place.",
            location = null,
            locationLiving = "Porto",
            locationFrom = "Lisbon",
            languages = listOf("eng"),
        )

        compose.setContent {
            TrustrootsTheme {
                EditProfileScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    profile = initial,
                    onSessionInvalidated = {},
                    onSaved = saved::set,
                    onCancel = {},
                )
            }
        }

        compose.onNodeWithText("Name").performTextReplacement("Updated Heron")
        compose.onNodeWithText("Tagline").performTextReplacement("A brighter fictional journey.")
        compose.onNodeWithText("Lives in").performTextReplacement("Faro")
        compose.onNodeWithText("From").performTextReplacement("Braga")
        compose.onNodeWithText("Languages").performClick()
        compose.onNodeWithText("Portuguese").performScrollTo().performClick()
        pressBackFromNonActivityRoot(compose.activity)
        compose.waitForIdle()
        compose.onNodeWithText("About me").performTextReplacement("A welcoming fictional place.")
        compose.onNodeWithText("Save changes").performClick()

        assertTrue("The profile update should reach the local API", updateArrived.await(10, TimeUnit.SECONDS))
        compose.onNodeWithText("Saving…").assertIsDisplayed()
        listOf("Name", "Tagline", "Lives in", "From", "Languages", "About me", "Saving…").forEach { label ->
            compose.onNodeWithText(label).assertIsNotEnabled()
        }
        assertTrue("Save callback must wait for the API response", saved.get() == null)
        val update = local.requests.single { it.method == "PUT" && it.path == "/api/users" }
        assertEquals(session.cookieHeader, update.cookie)
        val payload = org.json.JSONObject(update.body)
        assertEquals("Updated Heron", payload.getString("displayName"))
        assertEquals("A brighter fictional journey.", payload.getString("tagline"))
        assertEquals("A welcoming fictional place.", payload.getString("description"))
        assertEquals("Faro", payload.getString("locationLiving"))
        assertEquals("Braga", payload.getString("locationFrom"))
        assertEquals("[\"eng\",\"por\"]", payload.getJSONArray("languages").toString())

        allowUpdateResponse.countDown()
        compose.waitUntil(10_000) { saved.get()?.displayName == "Updated Heron" }
        assertEquals("Updated Heron", saved.get()?.displayName)
        compose.onNodeWithText("Save changes").assertIsDisplayed()
    }
}
