package org.trustroots.android.ui.circledetail

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.circles.CirclesFailure
import org.trustroots.android.ui.circles.CirclesFailureKind

@RunWith(AndroidJUnit4::class)
class CircleDetailBranchesJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun membershipActionWaitsForLoadedMembershipsAndPendingUpdates() {
        var membershipsLoaded by mutableStateOf(false)
        var isUpdating by mutableStateOf(false)
        var isMember by mutableStateOf(false)
        val membershipToggles = AtomicInteger()
        compose.setContent {
            CircleDetailContent(
                slug = CIRCLE.slug,
                circle = CIRCLE,
                session = SESSION,
                memberGroups = null,
                isLoadingMembers = false,
                api = MobileApiClient("http://127.0.0.1:1"),
                membershipsLoaded = membershipsLoaded,
                isMember = isMember,
                isLoading = !membershipsLoaded,
                isUpdating = isUpdating,
                failure = null,
                canRetryLoad = false,
                onRetry = {},
                contentPadding = PaddingValues.Zero,
                onBack = {},
                onToggleMembership = {
                    membershipToggles.incrementAndGet()
                    isUpdating = true
                },
                onOpenProfile = {},
            )
        }

        compose.onNodeWithText("Join circle").assertIsNotEnabled()
        assertEquals(0, membershipToggles.get())

        compose.runOnIdle { membershipsLoaded = true }
        compose.onNodeWithText("Join circle").assertIsEnabled().performClick()
        compose.onNodeWithText("Join circle").assertIsNotEnabled()
        assertEquals(1, membershipToggles.get())

        compose.runOnIdle {
            isMember = true
            isUpdating = false
        }
        compose.onNodeWithText("Leave circle").assertIsEnabled().performClick()
        compose.onNodeWithText("Leave circle").assertIsNotEnabled()
        assertEquals(2, membershipToggles.get())
    }

    @Test fun nonMemberCanJoinWithoutSeeingMemberGroups() {
        val membershipToggles = AtomicInteger()
        compose.setContent {
            CircleDetailContent(
                slug = CIRCLE.slug,
                circle = CIRCLE,
                session = SESSION,
                memberGroups = null,
                isLoadingMembers = false,
                api = MobileApiClient("http://127.0.0.1:1"),
                membershipsLoaded = true,
                isMember = false,
                isLoading = false,
                isUpdating = false,
                failure = null,
                canRetryLoad = false,
                onRetry = {},
                contentPadding = PaddingValues.Zero,
                onBack = {},
                onToggleMembership = { membershipToggles.incrementAndGet() },
                onOpenProfile = {},
            )
        }

        compose.onNodeWithText("Join circle").assertIsDisplayed().assertIsEnabled().performClick()
        assertEquals(1, membershipToggles.get())
        assertTrue(compose.onAllNodesWithText("Your contacts in this circle").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("People who recommend you").fetchSemanticsNodes().isEmpty())
    }

    @Test fun joinedMemberCanRetryAFailedMemberListUsingTheFallbackMessage() {
        val retries = AtomicInteger()
        compose.setContent {
            CircleDetailContent(
                slug = CIRCLE.slug,
                circle = CIRCLE,
                session = SESSION,
                memberGroups = null,
                isLoadingMembers = false,
                api = MobileApiClient("http://127.0.0.1:1"),
                membershipsLoaded = true,
                isMember = true,
                isLoading = false,
                isUpdating = false,
                failure = CirclesFailure(
                    kind = CirclesFailureKind.CIRCLE_MEMBERS_LOAD,
                    serverMessage = null,
                    apiFailureKind = null,
                ),
                canRetryLoad = true,
                onRetry = { retries.incrementAndGet() },
                contentPadding = PaddingValues.Zero,
                onBack = {},
                onToggleMembership = {},
                onOpenProfile = {},
            )
        }

        compose.onNodeWithText("Could not load circle members.").assertIsDisplayed()
        compose.onNodeWithText("Retry").assertIsDisplayed().performClick()
        assertEquals(1, retries.get())
    }

    private companion object {
        val SESSION = MemberSession("connect.sid=fictional-circle-session", MobileMember("steady-heron", "Steady Heron"))
        val CIRCLE = TrustrootsCircle(
            id = "fictional-circle-id",
            slug = "quiet-harbour",
            label = "Quiet Harbour",
            description = null,
            count = 4,
            image = false,
            color = null,
        )
    }
}
