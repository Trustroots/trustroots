package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class InboxSparseIdentityJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun participantWithoutIDCanOpenProfileButNotConversationAndRepeatedBackKeepsInboxRoot() {
        val session = MemberSession(
            "connect.sid=fictional-inbox-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages?page=1&limit=50" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"thread-sparse","userFrom":{"username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"fictional-self-id","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional preview without a participant ID."},"read":false}]""",
                    )
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-profile-id","username":"quiet-fox","displayName":"Quiet Fox","description":"A fictional profile for a neighbour."}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/fictional-profile-id?types=host" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contacts/fictional-profile-id" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/experiences?userTo=fictional-profile-id" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contact-by/fictional-profile-id" ->
                    LocalTransportFixture.Response("{}", status = 404)
                request.method == "GET" && request.path == "/api/blocked-users" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path.contains("/avatar?") ->
                    LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                MessageInboxScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional preview without a participant ID.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("message-thread-thread-sparse").performClick()
        compose.onNodeWithText("A fictional preview without a participant ID.").assertIsDisplayed()
        assertEquals(0, local.requests.count { it.path.startsWith("/api/messages/") })
        assertEquals(1, local.requests.count { it.path == "/api/messages?page=1&limit=50" })

        compose.onNodeWithText("Profile").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional profile for a neighbour.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional profile for a neighbour.").assertIsDisplayed()

        val back = requireNotNull(
            compose.onNodeWithContentDescription("Back")
                .fetchSemanticsNode().config[SemanticsActions.OnClick].action,
        )
        compose.runOnUiThread {
            back()
            back()
        }

        compose.onNodeWithTag("messageInboxFilter").assertIsDisplayed()
        compose.onNodeWithText("A fictional preview without a participant ID.").assertIsDisplayed()
        assertEquals(1, local.requests.count { it.path == "/api/messages?page=1&limit=50" })
        assertEquals(0, local.requests.count { it.path.startsWith("/api/messages/") })
        assertEquals(1, local.requests.count { it.path == "/api/users/quiet-fox" })
    }
}
