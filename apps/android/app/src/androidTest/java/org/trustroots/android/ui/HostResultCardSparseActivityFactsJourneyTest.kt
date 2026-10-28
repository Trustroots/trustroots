package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostResultCard

@RunWith(AndroidJUnit4::class)
class HostResultCardSparseActivityFactsJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun showsLastActiveWithoutReplyRateAndKeepsHostActionsAvailable() {
        val opened = AtomicBoolean(false)
        val closed = AtomicBoolean(false)
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                HostResultCard(
                    offer = HostOffer("offer-sparse", "yes", null, null, MessageMember(null, "quiet-fox", "Quiet Fox")),
                    profile = MemberProfile(
                        null,
                        "quiet-fox",
                        "Quiet Fox",
                        null,
                        null,
                        null,
                        languages = emptyList(),
                        lastActiveAtMillis = Instant.now().minusSeconds(2 * 24 * 60 * 60L).toEpochMilli(),
                    ),
                    sharedCircleIDs = emptySet(),
                    isMeet = false,
                    api = MobileApiClient("http://127.0.0.1:1"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onClose = { closed.set(true) },
                    onOpenProfile = { opened.set(true) },
                )
            }
        }

        compose.onNodeWithTag("hostResultActivityFacts", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithTag("hostResultLastActive", useUnmergedTree = true).assertIsDisplayed()
        assertTrue(compose.onAllNodesWithTag("hostResultReplyRate", useUnmergedTree = true).fetchSemanticsNodes().isEmpty())
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()

        compose.onNodeWithTag("hostResultCard").performClick()
        assertTrue(opened.get())
        compose.onNodeWithContentDescription("Close host result").performClick()
        assertTrue(closed.get())
    }
}
