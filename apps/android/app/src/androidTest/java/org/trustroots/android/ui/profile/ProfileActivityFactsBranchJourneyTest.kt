package org.trustroots.android.ui.profile

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.LocalTransportFixture

@RunWith(AndroidJUnit4::class)
class ProfileActivityFactsBranchJourneyTest {
    @get:Rule val compose = createComposeRule()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun showsReplyRateAndOmitsNullOrBlankActivityFacts() {
        showProfile(REPLY_RATE_ONLY)

        openAboutSection()
        compose.onNodeWithTag("profileActivityFacts").assertIsDisplayed()
        compose.onNodeWithText("Activity").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Reply rate").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileActivityReplyRate").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("82%").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileActivityLastActive").assertDoesNotExist()
        compose.onNodeWithTag("profileActivityReplyTime").assertDoesNotExist()
        compose.onAllNodesWithText("Last active").assertCountEquals(0)
        compose.onAllNodesWithText("Usually replies").assertCountEquals(0)
        assertNoAvatarRequests()
    }

    @Test fun showsReplyTimeAndOmitsInvalidOrBlankActivityFacts() {
        showProfile(REPLY_TIME_ONLY)

        openAboutSection()
        compose.onNodeWithTag("profileActivityFacts").assertIsDisplayed()
        compose.onNodeWithText("Activity").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Usually replies").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileActivityReplyTime").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Within 4 hours").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileActivityLastActive").assertDoesNotExist()
        compose.onNodeWithTag("profileActivityReplyRate").assertDoesNotExist()
        compose.onAllNodesWithText("Last active").assertCountEquals(0)
        compose.onAllNodesWithText("Reply rate").assertCountEquals(0)
        assertNoAvatarRequests()
    }

    @Test fun showsLastActiveWithoutReplyStatistics() {
        showProfile(LAST_ACTIVE_ONLY)

        openAboutSection()
        compose.onNodeWithTag("profileActivityFacts").assertIsDisplayed()
        compose.onNodeWithText("Activity").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Last active").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileActivityLastActive").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileActivityReplyRate").assertDoesNotExist()
        compose.onNodeWithTag("profileActivityReplyTime").assertDoesNotExist()
        assertNoAvatarRequests()
    }

    @Test fun hidesActivitySectionWhenEveryFactIsMissingOrBlank() {
        showProfile(WITHOUT_ACTIVITY_FACTS)

        openAboutSection()
        compose.onNodeWithTag("profileActivityFacts").assertDoesNotExist()
        compose.onAllNodesWithText("Activity").assertCountEquals(0)
        compose.onAllNodesWithText("Last active").assertCountEquals(0)
        compose.onAllNodesWithText("Reply rate").assertCountEquals(0)
        compose.onAllNodesWithText("Usually replies").assertCountEquals(0)
        assertNoAvatarRequests()
    }

    private fun showProfile(payload: String) {
        val local = LocalTransportFixture { request ->
            if (request.method == "GET" && request.path == "/api/users/quiet-fox") {
                LocalTransportFixture.Response(payload)
            } else {
                LocalTransportFixture.Response("{}", status = 404)
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
            local.requests.any { it.method == "GET" && it.path == "/api/users/quiet-fox" } &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun openAboutSection() {
        compose.onNodeWithTag("profileSection-about").performClick()
    }

    private fun assertNoAvatarRequests() {
        assertFalse(
            fixture!!.requests.any { it.path.contains("avatar") || it.path.startsWith("/uploads") },
        )
    }

    private companion object {
        const val REPLY_RATE_ONLY = """{
            "username":"quiet-fox",
            "displayName":"Quiet Fox",
            "replyRate":"82%",
            "replyTime":"  ",
            "seen":"not-a-timestamp"
        }"""

        const val REPLY_TIME_ONLY = """{
            "username":"quiet-fox",
            "displayName":"Quiet Fox",
            "replyRate":"  ",
            "replyTime":"4 hours",
            "seen":"not-a-timestamp"
        }"""

        const val WITHOUT_ACTIVITY_FACTS = """{
            "username":"quiet-fox",
            "displayName":"Quiet Fox",
            "seen":null,
            "replyRate":"",
            "replyTime":null
        }"""

        const val LAST_ACTIVE_ONLY = """{
            "username":"quiet-fox",
            "displayName":"Quiet Fox",
            "seen":"2025-01-01T00:00:00.000Z",
            "replyRate":" ",
            "replyTime":null
        }"""
    }
}
