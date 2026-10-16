package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ProfileLocalisedLanguageJourneyTest {
    @get:Rule val compose = createComposeRule()

    private var fixture: LocalTransportFixture? = null
    private val session = MemberSession(
        "connect.sid=fictional-language-session",
        MobileMember("steady-heron", "Steady Heron"),
    )

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun profileUsesLocaleDisplayNameForValidUnmappedLanguageCode() {
        val localApi = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-main","username":"quiet-fox","displayName":"Quiet Fox","languages":["fil"]}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/member-main?types=host" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contacts/member-main" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/experiences?userTo=member-main" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contact-by/member-main" ->
                    LocalTransportFixture.Response("{}", status = 404)
                request.path.contains("/avatar?") ->
                    LocalTransportFixture.Response("", status = 404)
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = localApi
        var backPressed = false

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(localApi.baseURL),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = { backPressed = true },
            )
        }

        compose.waitUntil(10_000) {
            localApi.requests.any { it.path == "/api/users/quiet-fox" } &&
                compose.onAllNodesWithText("Filipino", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Filipino", substring = true).performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        assertTrue("The profile remains navigable after rendering its language", backPressed)
    }
}
