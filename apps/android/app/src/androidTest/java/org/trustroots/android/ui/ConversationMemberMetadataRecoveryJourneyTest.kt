package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ConversationMemberMetadataRecoveryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun retriesMissingMemberMetadataAndShowsProfileWithoutUsernameAction() {
        val memberRequests = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/mini/member-id" -> {
                    if (memberRequests.incrementAndGet() == 1) {
                        LocalTransportFixture.Response(
                            """{"message":"Fictional member details are temporarily unavailable."}""",
                            status = 503,
                        )
                    } else {
                        LocalTransportFixture.Response(
                            """{"_id":"member-id","displayName":"Fictional Member"}""",
                        )
                    }
                }
                request.method == "GET" && request.path == "/api/messages/member-id?limit=100" ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }

        compose.setContent {
            ConversationRouteTestHarness(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(
                    "connect.sid=fictional-session",
                    MobileMember("steady-heron", "Steady Heron"),
                ),
                memberID = "member-id",
                onSessionInvalidated = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional member details are temporarily unavailable.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Messages").assertIsDisplayed()
        compose.onNodeWithTag("conversationFailure").assertIsDisplayed()
        compose.onNodeWithTag("conversationRetry").assertIsDisplayed().performClick()

        compose.waitUntil(10_000) {
            memberRequests.get() == 2 &&
                compose.onAllNodesWithText("Fictional Member").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("conversationFailure").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("Fictional Member").assertIsDisplayed()
        compose.onNodeWithTag("messageComposer").assertIsEnabled()
        compose.onNodeWithText("View profile").assertDoesNotExist()
        compose.onNodeWithTag("conversationRetry").assertDoesNotExist()
        assertEquals(1, local.requests.count { it.path == "/api/messages/member-id?limit=100" })
    }
}
