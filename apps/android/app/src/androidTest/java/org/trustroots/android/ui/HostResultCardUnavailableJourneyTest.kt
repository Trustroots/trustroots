package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostResultCardUnavailableJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun explainsWhenAMemberIsNotHosting() {
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                HostResultCard(
                    offer = HostOffer("offer-one", "no", null, null, MessageMember(null, null, "Quiet Fox")),
                    profile = null,
                    sharedCircleIDs = emptySet(),
                    isMeet = false,
                    api = MobileApiClient("http://127.0.0.1:1"),
                    session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                    onClose = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Not hosting currently").assertIsDisplayed()
        compose.onNodeWithTag("hostResultCard").assertIsDisplayed()
        compose.onNodeWithText("Up to").assertDoesNotExist()
    }
}
