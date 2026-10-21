package org.trustroots.android.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.editprofile.EditProfileScreen
import org.trustroots.android.ui.experience.CreateExperienceScreen
import org.trustroots.android.ui.hostoffer.HostOfferScreen

@RunWith(AndroidJUnit4::class)
class RetainedFormSessionRotationJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun retainedProfileEditKeepsDirtyFieldsAndSavesWithRotatedCookie() {
        val fixture = LocalTransportFixture { request ->
            if (request.method == "PUT" && request.path == "/api/users") {
                LocalTransportFixture.Response(
                    """{"_id":"member-self","username":"steady-heron","displayName":"Rotated Name","tagline":"A changed tagline"}""",
                )
            } else {
                error("Unexpected fictional request: ${request.method} ${request.path}")
            }
        }
        val api = MobileApiClient(fixture.baseURL)
        val session = mutableStateOf(session("connect.sid=old-fictional"))
        val saved = AtomicBoolean(false)
        try {
            compose.setContent {
                EditProfileScreen(
                    api = api,
                    session = session.value,
                    profile = MemberProfile("member-self", "steady-heron", "Steady Heron", "Old tagline", "Old about", null,
                        locationLiving = "Old Bay", locationFrom = "Old Coast", languages = emptyList()),
                    onSessionInvalidated = {},
                    onCancel = {},
                    onSaved = { saved.set(true) },
                )
            }

            compose.onNodeWithText("Name").performTextReplacement("Rotated Name")
            compose.onNodeWithText("Tagline").performTextReplacement("A changed tagline")
            compose.runOnIdle { session.value = session("connect.sid=rotated-fictional") }
            compose.onNodeWithText("Rotated Name").assertIsDisplayed()
            compose.onNodeWithText("A changed tagline").assertIsDisplayed()
            compose.onNodeWithText("Save changes").performClick()
            compose.waitUntil(10_000) { saved.get() }

            val request = fixture.requests.single { it.method == "PUT" && it.path == "/api/users" }
            assertTrue("Profile save should use the rotated cookie", request.cookie == "connect.sid=rotated-fictional")
            assertTrue("The edited name should survive rotation", request.body.contains("\"displayName\":\"Rotated Name\""))
            assertTrue("The edited tagline should survive rotation", request.body.contains("\"tagline\":\"A changed tagline\""))
        } finally {
            fixture.close()
        }
    }

    @Test fun retainedHostOfferKeepsDirtyDescriptionAndSavesWithRotatedCookie() {
        val fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response("""{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""")
                request.method == "GET" && request.path == "/api/offers-by/member-self?types=host" ->
                    LocalTransportFixture.Response("""[{"_id":"offer-one","type":"host","status":"yes","description":"A quiet room.","maxGuests":2,"location":[48.69,9.14]}]""")
                request.method == "PUT" && request.path == "/api/offers/offer-one" ->
                    LocalTransportFixture.Response("""{"_id":"offer-one","status":"maybe","description":"A changed hosting description.","maxGuests":2,"location":[48.69,9.14]}""")
                else -> error("Unexpected fictional request: ${request.method} ${request.path}")
            }
        }
        val api = MobileApiClient(fixture.baseURL)
        val session = mutableStateOf(session("connect.sid=old-fictional"))
        try {
            compose.setContent {
                HostOfferScreen(
                    api = api,
                    session = session.value,
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
            waitForText("A quiet room.")
            compose.onNodeWithText("Hosting description").performTextReplacement("A changed hosting description.")
            compose.runOnIdle { session.value = session("connect.sid=rotated-fictional") }
            compose.onNodeWithText("A changed hosting description.").assertIsDisplayed()
            compose.onNodeWithText("Save changes").performClick()
            waitForText("Hosting offer saved.")

            val request = fixture.requests.single { it.method == "PUT" && it.path == "/api/offers/offer-one" }
            assertTrue("Host offer save should use the rotated cookie", request.cookie == "connect.sid=rotated-fictional")
            assertTrue("The edited description should survive rotation", request.body.contains("A changed hosting description."))
        } finally {
            fixture.close()
        }
    }

    @Test fun retainedExperienceKeepsDirtyFeedbackAndSubmitsWithRotatedCookie() {
        val fixture = LocalTransportFixture { request ->
            if (request.method == "POST" && request.path == "/api/experiences") {
                LocalTransportFixture.Response("{}")
            } else {
                error("Unexpected fictional request: ${request.method} ${request.path}")
            }
        }
        val api = MobileApiClient(fixture.baseURL)
        val session = mutableStateOf(session("connect.sid=old-fictional"))
        val created = AtomicBoolean(false)
        try {
            compose.setContent {
                CreateExperienceScreen(
                    api = api,
                    session = session.value,
                    memberID = "member-two",
                    memberLabel = "Quiet Fox",
                    onSessionInvalidated = {},
                    onBack = {},
                    onCreated = { created.set(true) },
                )
            }
            compose.onNodeWithText("Public experience (optional)").performTextReplacement("A thoughtful visit with kind company.")
            compose.runOnIdle { session.value = session("connect.sid=rotated-fictional") }
            compose.onNodeWithText("A thoughtful visit with kind company.").assertIsDisplayed()
            compose.onNodeWithText("Save changes").performClick()
            compose.waitUntil(10_000) { created.get() }

            val request = fixture.requests.single { it.method == "POST" && it.path == "/api/experiences" }
            assertTrue("Experience submit should use the rotated cookie", request.cookie == "connect.sid=rotated-fictional")
            assertTrue("The edited feedback should survive rotation", request.body.contains("A thoughtful visit with kind company."))
            assertTrue("The experience should target the selected member", request.body.contains("member-two"))
        } finally {
            fixture.close()
        }
    }

    private fun session(cookie: String) = MemberSession(cookie, MobileMember("steady-heron", "Steady Heron"))

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(text).assertIsDisplayed()
    }
}
