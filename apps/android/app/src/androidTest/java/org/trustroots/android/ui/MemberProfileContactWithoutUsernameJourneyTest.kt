package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MemberProfileContactWithoutUsernameJourneyTest {
    @get:Rule val compose = createComposeRule()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun profileContactWithoutUsernameRemainsVisibleWithoutOpeningAnotherProfile() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"profile-member","username":"quiet-fox","displayName":"Quiet Fox","tagline":null,"description":null,"languages":[],"circles":[]}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/profile-member?types=host" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contacts/profile-member" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"contact-partial","user":{"_id":"unlisted-member","username":null,"displayName":"Unnamed Contact"}}]""",
                    )
                request.method == "GET" && request.path == "/api/experiences?userTo=profile-member" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contact-by/profile-member" ->
                    LocalTransportFixture.Response("{}", status = 404)
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/users/quiet-fox" } &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileSection-contacts").performClick()
        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/contacts/profile-member" } &&
                compose.onAllNodesWithText("Unnamed Contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileContact-contact-partial").performScrollTo().assertIsDisplayed().performClick()

        // The pager can retain an off-screen page with its own section bar.
        compose.onAllNodesWithTag("profileSection-contacts")[0].assertIsSelected()
        compose.onNodeWithTag("profilePager").assertIsDisplayed()
        compose.onNodeWithText("Unnamed Contact").assertIsDisplayed()
        assertEquals(1, local.requests.count { it.path == "/api/users/quiet-fox" })
    }
}
