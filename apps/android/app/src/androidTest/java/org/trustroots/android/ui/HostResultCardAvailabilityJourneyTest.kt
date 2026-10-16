package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostResultCardAvailabilityJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun meetResultWithoutUsernameShowsMeetStatusAndOnlyAllowsClose() {
        val opened = AtomicBoolean(false)
        val closed = AtomicBoolean(false)
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                HostResultCard(
                    offer = HostOffer("offer-one", "no", null, null, MessageMember(null, null, "Anonymous member")),
                    profile = null,
                    sharedCircleIDs = emptySet(),
                    isMeet = true,
                    api = MobileApiClient("http://127.0.0.1:1"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onClose = { closed.set(true) },
                    onOpenProfile = { opened.set(true) },
                )
            }
        }

        compose.onNodeWithText("Anonymous member").assertIsDisplayed()
        compose.onNodeWithText("Available to meet").assertIsDisplayed()
        compose.onNodeWithTag("hostResultCard").performClick()
        assertFalse(opened.get())
        compose.onNodeWithContentDescription("Close host result").performClick()
        assertTrue(closed.get())
    }
}
