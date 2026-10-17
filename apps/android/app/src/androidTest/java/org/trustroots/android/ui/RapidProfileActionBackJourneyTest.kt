package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.isDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser

@RunWith(AndroidJUnit4::class)
class RapidProfileActionBackJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val session = MemberSession(
        "connect.sid=fictional-profile-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun immediateSystemBackAfterAccessibleMessageActionKeepsTheProfile() {
        val backCalls = AtomicInteger()
        val local = startProfile(backCalls)

        dispatchAccessibleClickThenSystemBack("Send a message")

        compose.onNodeWithText("Send a message").assertIsDisplayed()
        assertEquals("Back before the next composition should pop the pending conversation", 0, backCalls.get())
        assertFalse(local.requests.any { it.method == "POST" })
        assertFalse(local.requests.any { it.path == "/api/messages/profile-member?limit=100" })
    }

    @Test fun immediateSystemBackAfterAccessibleShareActionKeepsTheProfile() {
        val backCalls = AtomicInteger()
        val local = startProfile(backCalls)

        dispatchAccessibleClickThenSystemBack("Share your experience")

        compose.onNodeWithText("Share your experience").assertIsDisplayed()
        assertEquals("Back before the next composition should pop the pending experience form", 0, backCalls.get())
        assertFalse(local.requests.any { it.method == "POST" })
        assertTrue(compose.onAllNodesWithText("Experience with Quiet Fox").fetchSemanticsNodes().isEmpty())
    }

    @Test fun immediateSystemBackAfterAccessibleAddContactKeepsTheProfile() {
        val backCalls = AtomicInteger()
        val local = startProfile(backCalls, contactRelationship = LocalTransportFixture.Response("{}", status = 404)) {
                _, _, _ -> Text("Browser child mounted")
            }

        dispatchAccessibleClickThenSystemBack("Add contact")

        compose.onNodeWithText("Add contact").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Browser child mounted").fetchSemanticsNodes().isEmpty())
        assertEquals(0, backCalls.get())
        assertFalse(local.requests.any { it.method == "POST" || it.method == "DELETE" })
    }

    @Test fun immediateSystemBackAfterAccessibleRelatedProfileActionKeepsTheProfile() {
        val backCalls = AtomicInteger()
        val local = startProfile(
            backCalls,
            contacts = """[{"_id":"contact-one","user":{"_id":"related-member","username":"calm-lynx","displayName":"Calm Lynx"}}]""",
        )
        compose.onNodeWithTag("profileSection-contacts").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Calm Lynx").fetchSemanticsNodes().isNotEmpty()
        }

        dispatchAccessibleClickThenSystemBack("Calm Lynx", testTag = "profileContact-contact-one")

        assertFalse(local.requests.any { it.path == "/api/users/calm-lynx" })
        val contactsTabs = compose.onAllNodesWithTag("profileSection-contacts")
        val visibleContactIndices = contactsTabs.fetchSemanticsNodes().indices.filter { contactsTabs[it].isDisplayed() }
        assertEquals("Exactly one contacts tab should be in the pager viewport", 1, visibleContactIndices.size)
        contactsTabs[visibleContactIndices.single()].assertIsSelected()
        compose.onNodeWithText("Send a message").assertIsDisplayed()
        compose.onNodeWithText("Calm Lynx").assertIsDisplayed()
        assertEquals(0, backCalls.get())
        assertFalse(local.requests.any { it.method == "POST" || it.method == "DELETE" })
    }

    @Test fun immediateSystemBackAfterAccessibleRemoveContactKeepsTheProfile() {
        val backCalls = AtomicInteger()
        val local = startProfile(
            backCalls,
            contactRelationship = LocalTransportFixture.Response(
                """{"_id":"relationship-one","confirmed":true}""",
            ),
        )

        dispatchAccessibleClickThenSystemBack("Remove contact")

        compose.onNodeWithText("Remove contact").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Remove contact?").fetchSemanticsNodes().isEmpty())
        assertEquals(0, backCalls.get())
        assertFalse(local.requests.any { it.method == "POST" || it.method == "DELETE" })
    }

    private fun startProfile(
        backCalls: AtomicInteger,
        contacts: String = "[]",
        contactRelationship: LocalTransportFixture.Response = LocalTransportFixture.Response("{}", status = 404),
        browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = { route, close, padding ->
            TrustrootsBrowser(route, close, padding)
        },
    ): LocalTransportFixture {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"profile-member","username":"quiet-fox","displayName":"Quiet Fox"}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/profile-member?types=host" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contacts/profile-member" ->
                    LocalTransportFixture.Response(contacts)
                request.method == "GET" && request.path == "/api/experiences?userTo=profile-member" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contact-by/profile-member" ->
                    contactRelationship
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = local
        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(local.baseURL),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = { backCalls.incrementAndGet() },
                browserContent = browserContent,
            )
        }
        return local
    }

    private fun dispatchAccessibleClickThenSystemBack(label: String, testTag: String? = null) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(label).fetchSemanticsNodes().isNotEmpty()
        }
        val actionNode = if (testTag == null) compose.onNodeWithText(label) else compose.onNodeWithTag(testTag)
        actionNode.assertIsDisplayed()
        actionNode.assertIsEnabled()
        actionNode.assertHasClickAction()
        val onClick = requireNotNull(actionNode.fetchSemanticsNode().config[SemanticsActions.OnClick].action)
        val clickAccepted = AtomicBoolean(false)

        // Keep the accessible click and system Back in one UI turn, before Compose synchronises between events.
        compose.runOnUiThread {
            clickAccepted.set(onClick())
            compose.activity.onBackPressedDispatcher.onBackPressed()
        }
        assertTrue("The enabled accessibility click action should be accepted", clickAccepted.get())
        compose.waitForIdle()
    }
}
