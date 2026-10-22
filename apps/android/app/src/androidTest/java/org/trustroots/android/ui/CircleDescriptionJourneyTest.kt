package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen

@RunWith(AndroidJUnit4::class)
class CircleDescriptionJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun formattedDescriptionKeepsItsVisibleLinkInertOnCircleDetails() {
        val local = LocalTransportFixture { request ->
            when (request.path) {
                "/api/tribes?limit=150" -> LocalTransportFixture.Response(
                    """[{"_id":"circle-fictional","slug":"harbour","label":"Harbour Circle","count":4,"description":"<p>Meet <strong>local walkers</strong>.</p><ul><li>Share routes</li></ul><p>See <a href='https://example.invalid/'>the guide</a>.</p>"}]""",
                )
                "/api/tribes/harbour" -> LocalTransportFixture.Response(
                    """{"_id":"circle-fictional","slug":"harbour","label":"Harbour Circle","count":4,"description":"<p>Meet <strong>local walkers</strong>.</p><ul><li>Share routes</li></ul><p>See <a href='https://example.invalid/'>the guide</a>.</p>"}""",
                )
                "/api/users/memberships" -> LocalTransportFixture.Response("[]")
                else -> error("Unexpected circle fixture request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            NativeTestAppFrame(Destination.Circles) {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional-circle-session", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Harbour Circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Harbour Circle").assertIsDisplayed().performClick()
        compose.onNodeWithText("local walkers", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Share routes", substring = true).assertIsDisplayed()
        compose.onNodeWithText("the guide", substring = true).assertIsDisplayed().performClick()
        compose.onNodeWithText("Join circle").assertIsDisplayed()
    }
}
