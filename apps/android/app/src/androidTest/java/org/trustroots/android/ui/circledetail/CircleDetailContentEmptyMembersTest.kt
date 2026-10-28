package org.trustroots.android.ui.circledetail

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
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

/** Verifies a joined circle remains usable while its member response has no result yet. */
@RunWith(AndroidJUnit4::class)
class CircleDetailContentEmptyMembersTest {
    @get:Rule val compose = createComposeRule()

    @Test fun joinedCircleKeepsMembershipAndBackActionsWhenMemberGroupsAreAbsent() {
        val backCalls = AtomicInteger()
        val membershipCalls = AtomicInteger()
        compose.setContent {
            CircleDetailContent(
                slug = "quiet-harbour",
                circle = TrustrootsCircle(
                    id = "circle-harbour",
                    slug = "quiet-harbour",
                    label = "Quiet Harbour",
                    description = "A fictional circle.",
                    count = 3,
                    image = false,
                    color = null,
                ),
                session = MemberSession(
                    "connect.sid=fictional-circle-session",
                    MobileMember("steady-heron", "Steady Heron"),
                ),
                memberGroups = null,
                isLoadingMembers = false,
                api = MobileApiClient("http://127.0.0.1:1"),
                membershipsLoaded = true,
                isMember = true,
                isLoading = false,
                isUpdating = false,
                failure = null,
                canRetryLoad = false,
                onRetry = {},
                contentPadding = androidx.compose.foundation.layout.PaddingValues.Zero,
                onBack = { backCalls.incrementAndGet() },
                onToggleMembership = { membershipCalls.incrementAndGet() },
                onOpenProfile = {},
            )
        }

        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("A fictional circle.").assertIsDisplayed()
        compose.onNodeWithText("Leave circle").assertIsDisplayed().assertIsEnabled()
        assertTrue(compose.onAllNodesWithText("Your contacts in this circle").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("No members to show yet.").fetchSemanticsNodes().isEmpty())

        compose.onNodeWithText("Leave circle").performClick()
        compose.onNodeWithTag("circleDetailBack").performClick()
        assertEquals(1, membershipCalls.get())
        assertEquals(1, backCalls.get())
    }
}
