package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen

/** Checks optional member IDs do not create broken profile, message, or experience routes. */
@RunWith(AndroidJUnit4::class)
class MemberProfileMissingIdentityJourneyTest {
    @get:Rule val compose = createComposeRule()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun missingMemberIDKeepsProfileUsableWithoutOpeningIdBasedDestinations() {
        val localRequests = CopyOnWriteArrayList<LocalTransportFixture.Request>()
        val local = LocalTransportFixture { request ->
            localRequests += request
            when (request.method to request.path) {
                "GET" to "/api/users/quiet-fox" -> LocalTransportFixture.Response(PROFILE)
                "GET" to "/api/blocked-users" -> LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }
        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(
                    "connect.sid=fictional-profile-session",
                    MobileMember("steady-heron", "Steady Heron"),
                ),
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("More profile actions").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithTag("profileAvatar").fetchSemanticsNodes().isEmpty())

        compose.waitUntil(10_000) {
            runCatching {
                compose.onNodeWithTag("profileMessageAction").assertIsEnabled()
                true
            }.getOrDefault(false)
        }
        compose.onNodeWithTag("profileMessageAction").assertIsEnabled().performClick()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()

        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.onNodeWithText("Share your experience").performClick()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Experience with Quiet Fox").fetchSemanticsNodes().isEmpty())
        assertTrue(
            "Only the username-based profile and block-status request should be needed without a member ID",
            localRequests.none { it.path.startsWith("/api/experiences") || it.path.startsWith("/api/messages") },
        )
    }

    private companion object {
        const val PROFILE = """{"username":"quiet-fox","displayName":"Quiet Fox"}"""
    }
}
