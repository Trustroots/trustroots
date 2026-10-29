package org.trustroots.android.ui.circledetail

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CircleMemberGroupBranchJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun sparseMembersKeepVisibleLabelsAndOnlyNamedRowsNavigate() {
        val openedProfiles = mutableListOf<String>()
        val local = LocalTransportFixture { request ->
            if (request.method == "GET" && request.path.contains("/avatar?")) {
                LocalTransportFixture.Response("", status = 404)
            } else {
                error("Unexpected local request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }
        val session = MemberSession(
            "connect.sid=fictional-circle-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val members = listOf(
            MessageMember(id = null, username = "calm-lynx", displayName = " \t "),
            MessageMember(id = "fictional-member-id", username = null, displayName = "Nameless Neighbour"),
            MessageMember(id = "fictional-profile-id", username = "quiet-fox", displayName = "Quiet Fox"),
        )

        compose.setContent {
            TrustrootsTheme {
                CircleDetailContent(
                    slug = "quiet-harbour",
                    circle = TrustrootsCircle(
                        id = "fictional-circle-id",
                        slug = "quiet-harbour",
                        label = "Quiet Harbour",
                        description = "A fictional circle.",
                        count = members.size,
                        image = false,
                        color = null,
                    ),
                    session = session,
                    memberGroups = CircleMemberGroups(contacts = members, recommenders = emptyList(), active = emptyList()),
                    isLoadingMembers = false,
                    api = MobileApiClient(local.baseURL),
                    membershipsLoaded = true,
                    isMember = true,
                    isLoading = false,
                    isUpdating = false,
                    failure = null,
                    canRetryLoad = false,
                    onRetry = {},
                    contentPadding = PaddingValues.Zero,
                    onBack = {},
                    onToggleMembership = {},
                    onOpenProfile = { openedProfiles += it },
                )
            }
        }

        compose.onNodeWithText("calm-lynx").assertIsDisplayed()
        compose.onNodeWithText("@calm-lynx").assertIsDisplayed()
        compose.onNodeWithText("Nameless Neighbour").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()

        compose.onNodeWithTag("circleMember-null").performClick()
        assertEquals("Rows without a username remain inert", emptyList<String>(), openedProfiles)

        compose.onNodeWithTag("circleMember-calm-lynx").performClick()
        compose.onNodeWithTag("circleMember-quiet-fox").performClick()
        assertEquals(listOf("calm-lynx", "quiet-fox"), openedProfiles)
        compose.waitUntil(5_000) { local.requests.size == 2 }
        assertEquals(
            listOf("fictional-member-id", "fictional-profile-id"),
            local.requests.map { request -> request.path.substringAfter("/api/users/").substringBefore("/avatar?") }.sorted(),
        )
        assertTrue(local.requests.all { it.cookie == session.cookieHeader })
    }

    @Test fun memberWithNoDisplayNameOrUsernameRemainsSafeAndCannotNavigate() {
        val openedProfiles = mutableListOf<String>()
        val session = MemberSession(
            "connect.sid=fictional-circle-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val member = MessageMember(id = null, username = null, displayName = " \t ")

        compose.setContent {
            TrustrootsTheme {
                CircleDetailContent(
                    slug = "quiet-harbour",
                    circle = TrustrootsCircle(
                        id = "fictional-circle-id",
                        slug = "quiet-harbour",
                        label = "Quiet Harbour",
                        description = null,
                        count = 1,
                        image = false,
                        color = null,
                    ),
                    session = session,
                    memberGroups = CircleMemberGroups(contacts = listOf(member), recommenders = emptyList(), active = emptyList()),
                    isLoadingMembers = false,
                    api = MobileApiClient("http://127.0.0.1:1"),
                    membershipsLoaded = true,
                    isMember = true,
                    isLoading = false,
                    isUpdating = false,
                    failure = null,
                    canRetryLoad = false,
                    onRetry = {},
                    contentPadding = PaddingValues.Zero,
                    onBack = {},
                    onToggleMembership = {},
                    onOpenProfile = { openedProfiles += it },
                )
            }
        }

        compose.onNodeWithTag("circleMember-null").assertIsDisplayed().performClick()
        assertTrue("An unidentified row must not navigate to a profile", openedProfiles.isEmpty())
    }
}
