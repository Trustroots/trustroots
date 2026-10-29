package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MemberProfileSaveHandoffSessionRotationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun freshProfileForRotatedSessionWinsOverSavedProfileCompletion() {
        val originalCookie = "connect.sid=fictional-original"
        val refreshedCookie = "connect.sid=fictional-refreshed"
        val session = mutableStateOf(
            MemberSession(originalCookie, MobileMember("quiet-fox", "Quiet Fox")),
        )
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" && request.cookie == originalCookie ->
                    LocalTransportFixture.Response(profile("Quiet Fox", "Original profile line"))
                request.method == "PUT" && request.path == "/api/users" ->
                    LocalTransportFixture.Response(profile("Saved Fox", "Saved profile line"))
                request.method == "GET" && request.path == "/api/users/quiet-fox" && request.cookie == refreshedCookie ->
                    LocalTransportFixture.Response(profile("Refreshed Fox", "Refreshed profile line"))
                request.path == "/api/offers-by/fictional-profile-id?types=host" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contacts/fictional-profile-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/experiences?userTo=fictional-profile-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contact-by/fictional-profile-id" -> LocalTransportFixture.Response("{}", status = 404)
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path} (${request.cookie})")
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                MemberProfileScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session.value,
                    username = "quiet-fox",
                    onSessionInvalidated = {},
                    onOwnProfileSaved = {
                        session.value = MemberSession(
                            refreshedCookie,
                            MobileMember("quiet-fox", "Quiet Fox"),
                        )
                    },
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Original profile line").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Edit your profile").performClick()
        compose.onNodeWithText("Quiet Fox").performTextReplacement("Saved Fox")
        compose.onNodeWithText("Save changes").performClick()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Refreshed profile line").fetchSemanticsNodes().isNotEmpty()
        }

        val saveRequest = local.requests.single { it.method == "PUT" && it.path == "/api/users" }
        assertEquals("The edit should be saved with the original session", originalCookie, saveRequest.cookie)
        assertTrue("The refreshed session should load the profile again", local.requests.any {
            it.method == "GET" && it.path == "/api/users/quiet-fox" && it.cookie == refreshedCookie
        })
        compose.onNodeWithText("Refreshed Fox").assertIsDisplayed()
        compose.onNodeWithText("Refreshed profile line").assertIsDisplayed()
        assertTrue(
            "A completion for the previous session must not replace the refreshed profile",
            compose.onAllNodesWithText("Saved profile line").fetchSemanticsNodes().isEmpty(),
        )
        assertEquals(1, local.requests.count {
            it.method == "GET" && it.path == "/api/users/quiet-fox" && it.cookie == refreshedCookie
        })
    }

    private fun profile(displayName: String, tagline: String): String =
        """{"_id":"fictional-profile-id","username":"quiet-fox","displayName":"$displayName","tagline":"$tagline","description":"A fictional profile description.","languages":[]}"""
}
