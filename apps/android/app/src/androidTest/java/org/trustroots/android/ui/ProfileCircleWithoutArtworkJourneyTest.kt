package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ProfileCircleWithoutArtworkJourneyTest {
    @get:Rule val compose = createComposeRule()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun profileShowsCircleWithoutRequestingArtworkWhenCircleHasNoImage() {
        val localApi = LocalTransportFixture { request ->
            when (request.method to request.path) {
                "GET" to "/api/users/quiet-fox" -> LocalTransportFixture.Response(PROFILE_WITH_CIRCLE_WITHOUT_IMAGE)
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = localApi
        val session = MemberSession(
            "connect.sid=fictional-profile-session",
            MobileMember("steady-heron", "Steady Heron"),
        )

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(localApi.baseURL),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            localApi.requests.any { it.method == "GET" && it.path == "/api/users/quiet-fox" } &&
                compose.onAllNodesWithText("Quiet Harbour Circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileSection-about").performClick()
        compose.onNodeWithText("Quiet Harbour Circle").performScrollTo().assertIsDisplayed()
        compose.waitForIdle()

        assertEquals(1, localApi.requests.size)
        assertEquals("GET", localApi.requests.single().method)
        assertEquals("/api/users/quiet-fox", localApi.requests.single().path)
        assertEquals(session.cookieHeader, localApi.requests.single().cookie)
        assertFalse(localApi.requests.any { it.path.startsWith("/uploads-circle/") || it.path.contains("/avatar?") })
    }

    private companion object {
        const val PROFILE_WITH_CIRCLE_WITHOUT_IMAGE = """{
            "username":"quiet-fox",
            "displayName":"Quiet Fox",
            "member":[{
                "tribe":{
                    "_id":"circle-harbour",
                    "slug":"quiet-harbour",
                    "label":"Quiet Harbour Circle",
                    "count":4,
                    "image":false
                }
            }]
        }"""
    }
}
