package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
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
}
