package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.shared.ui.PilotConnections
import org.trustroots.shared.ui.PilotNote
import org.trustroots.shared.ui.PilotGateway
import org.trustroots.shared.ui.PilotMessage
import org.trustroots.shared.ui.PilotPerson
import org.trustroots.shared.ui.PilotProfile
import org.trustroots.shared.ui.PilotThread
import org.trustroots.shared.ui.SharedComposeRoot

@RunWith(AndroidJUnit4::class)
class SharedDashboardJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun dashboardWorksWithoutDiscoveryAndReturnsFromMemberJourneys() {
        var exited = false
        val gateway = object : PilotGateway {
            override fun featuredNotes(completion: (List<PilotNote>?, String?) -> Unit) {
                completion(null, "Featured notes unavailable")
            }
            override fun connections(completion: (PilotConnections?, String?) -> Unit) {
                completion(null, "Connections unavailable")
            }
            override fun signIn(username: String, password: String, completion: (String?) -> Unit) = error("Unexpected sign-in")
            override fun signOut(completion: (String?) -> Unit) = error("Unexpected sign-out")
            override fun profile(username: String, completion: (PilotProfile?, String?) -> Unit) {
                completion(null, "Profile unavailable")
            }
            override fun inbox(page: Int, completion: (List<PilotThread>?, String?) -> Unit) {
                completion(emptyList(), null)
            }
            override fun conversation(memberId: String, completion: (List<PilotMessage>?, String?) -> Unit) = error("Unexpected conversation")
            override fun send(memberId: String, content: String, completion: (PilotMessage?, String?) -> Unit) = error("Unexpected send")
            override fun loadDraft(partner: PilotPerson) = ""
            override fun saveDraft(partner: PilotPerson, value: String) = Unit
            override fun exit() { exited = true }
        }
        compose.setContent { SharedComposeRoot(gateway, "sample-member", null) }
        compose.onNodeWithText("Welcome to Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Trustroots updates").assertDoesNotExist()
        compose.onNodeWithText("Connections on the map").assertDoesNotExist()
        compose.onNodeWithText("Learn about Nostroots").assertDoesNotExist()
        compose.onNodeWithText("My profile").performScrollTo().performClick()
        compose.onNodeWithText("Profile unavailable").assertIsDisplayed()
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithText("Messages").performScrollTo().performClick()
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithText("Welcome to Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Open native app").performClick()
        assertEquals(true, exited)
    }
}
