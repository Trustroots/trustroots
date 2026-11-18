package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.semantics.SemanticsActions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.MemberIdentity
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MemberIdentityJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun namedAndIncompleteMembersHaveReadableIdentityRows() {
        val api = MobileApiClient("http://127.0.0.1:1")
        val session = MemberSession("connect.sid=fictional", MobileMember("quiet-fox", "Quiet Fox"))
        compose.setContent {
            TrustrootsTheme {
                Column {
                    MemberIdentity(api, session, MessageMember(null, "sample-walker", " Sample Walking Companion "))
                    MemberIdentity(api, session, MessageMember(null, "handle-only", " "))
                    MemberIdentity(api, session, MessageMember(null, null, "Name Only"))
                    MemberIdentity(api, session, MessageMember(null, " ", ""))
                }
            }
        }
        compose.onNodeWithText("Sample Walking Companion").assertIsDisplayed()
        compose.onNodeWithText("@sample-walker").assertIsDisplayed()
        compose.onAllNodesWithText("@handle-only").assertCountEquals(1)
        compose.onNodeWithText("Name Only").assertIsDisplayed()
        compose.onNodeWithText("Trustroots member").assertIsDisplayed()
    }

    @Test fun compactIdentityEllipsisesLongNamesAndHandles() {
        val api = MobileApiClient("http://127.0.0.1:1")
        val session = MemberSession("connect.sid=fictional", MobileMember("quiet-fox", "Quiet Fox"))
        val name = "A Fictional Member With A Very Long Display Name"
        val username = "fictional-member-with-a-very-long-username"
        compose.setContent {
            TrustrootsTheme {
                MemberIdentity(
                    api, session, MessageMember(null, username, name),
                    modifier = Modifier.width(180.dp),
                    avatarSize = 36.dp,
                    maxLines = 1,
                )
            }
        }
        for (label in listOf(name, "@$username")) {
            val layouts = mutableListOf<TextLayoutResult>()
            compose.onNodeWithText(label).assertIsDisplayed()
                .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            assertEquals(1, layouts.single().lineCount)
            assertTrue(layouts.single().isLineEllipsized(0))
        }
    }
}
