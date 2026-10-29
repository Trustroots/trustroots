package org.trustroots.android.ui.circledetail

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
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
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CircleMemberSparseGroupsJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun recommenderOnlyAndActiveOnlyGroupsRemainDiscoverable() {
        val groups = mutableStateOf(
            CircleMemberGroups(
                contacts = emptyList(),
                recommenders = listOf(MessageMember(id = null, username = "quiet-fox", displayName = "Quiet Fox")),
                active = emptyList(),
            ),
        )
        compose.setContent {
            TrustrootsTheme {
                CircleDetailContent(
                    slug = "quiet-harbour",
                    circle = TrustrootsCircle(
                        id = "circle-harbour",
                        slug = "quiet-harbour",
                        label = "Quiet Harbour",
                        description = null,
                        count = 2,
                        image = false,
                        color = null,
                    ),
                    session = MemberSession(
                        "connect.sid=fictional-circle-session",
                        MobileMember("steady-heron", "Steady Heron"),
                    ),
                    memberGroups = groups.value,
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
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("People who recommend you").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Other active members").fetchSemanticsNodes().isEmpty())

        compose.runOnIdle {
            groups.value = CircleMemberGroups(
                contacts = emptyList(),
                recommenders = emptyList(),
                active = listOf(MessageMember(id = null, username = "calm-lynx", displayName = "Calm Lynx")),
            )
        }

        compose.onNodeWithText("Other active members").assertIsDisplayed()
        compose.onNodeWithText("Calm Lynx").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("People who recommend you").fetchSemanticsNodes().isEmpty())
    }
}
