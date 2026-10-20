package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.inbox.MessageInboxScreen

@RunWith(AndroidJUnit4::class)
class InboxParticipantWithoutUsernameJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun opensThreadByParticipantIDWhenUsernameIsAbsent() {
        val participantID = "fictional-inbox-member-id"
        val session = MemberSession(
            "connect.sid=fictional-inbox-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages?page=1&limit=50" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-thread-id","userFrom":{"_id":"$participantID","displayName":"Fictional Neighbour"},"userTo":{"_id":"fictional-self-id","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional message preview."},"read":false}]""",
                    )
                request.method == "GET" && request.path == "/api/messages/$participantID?limit=100" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-message-id","content":"A fictional note from the neighbour.","created":"${Instant.parse("2025-02-03T04:05:06Z")}","userFrom":{"_id":"$participantID","displayName":"Fictional Neighbour"}}]""",
                    )
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
            local.requests.any {
                it.method == "GET" && it.path == "/api/messages?page=1&limit=50"
            } && compose.onAllNodesWithText("A fictional message preview.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional Neighbour").assertIsDisplayed()
        compose.onNodeWithText("Profile").assertDoesNotExist()

        compose.onNodeWithText("A fictional message preview.").performClick()

        compose.waitUntil(10_000) {
            local.requests.any {
                it.method == "GET" && it.path == "/api/messages/$participantID?limit=100"
            } && compose.onAllNodesWithText("A fictional note from the neighbour.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional Neighbour").assertIsDisplayed()
        compose.onNodeWithText("A fictional note from the neighbour.").assertIsDisplayed()

        val inboxRequest = local.requests.single { it.path == "/api/messages?page=1&limit=50" }
        val threadRequest = local.requests.single { it.path == "/api/messages/$participantID?limit=100" }
        assertEquals(session.cookieHeader, inboxRequest.cookie)
        assertEquals(session.cookieHeader, threadRequest.cookie)
        assertTrue(local.requests.all { it.method == "GET" })
    }
}
