package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.contacts.ContactsScreen
import org.trustroots.android.ui.conversation.ConversationScreen

@RunWith(AndroidJUnit4::class)
class MessageTransportFailureJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun inboxTransportFailureStopsLoadingAndLeavesFilterAvailable() {
        val local = startFixture { request ->
            if (request.method == "GET" && request.path == "/api/messages?page=1&limit=50") null
            else LocalTransportFixture.Response("{}", status = 404)
        }
        var invalidations = 0
        compose.setContent {
            TrustrootsTheme {
                MessageInboxScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session(),
                    onSessionInvalidated = { invalidations++ },
                )
            }
        }

        awaitTransportError(setOf("Messages", "Filter conversations"))
        compose.onNodeWithText("Messages").assertIsDisplayed()
        compose.onNodeWithText("Filter conversations").assertIsDisplayed()
        compose.onNodeWithText("No conversations yet.").assertDoesNotExist()
        assertEquals(0, invalidations)
        assertTrue(local.requests.any { it.method == "GET" && it.path == "/api/messages?page=1&limit=50" })
    }

    @Test fun conversationTransportFailureStopsLoadingAndLeavesComposerAvailable() {
        val local = startFixture { request ->
            if (request.method == "GET" && request.path == "/api/messages/fictional-contact?limit=100") null
            else LocalTransportFixture.Response("{}", status = 404)
        }
        var invalidations = 0
        compose.setContent {
            TrustrootsTheme {
                ConversationScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session(),
                    member = MessageMember("fictional-contact", "fictional-contact", "Fictional Contact"),
                    onSessionInvalidated = { invalidations++ },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        awaitTransportError(setOf("Back", "Fictional Contact", "F", "Message", "Send", "Yes, I can host!", "Sorry I can't host", "Write back"))
        compose.onNodeWithTag("messageComposer").assertIsDisplayed().assertIsEnabled()
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        assertEquals(0, invalidations)
        assertTrue(local.requests.any { it.method == "GET" && it.path == "/api/messages/fictional-contact?limit=100" })
    }

    @Test fun contactsTransportFailureStopsLoadingAndLeavesBackActionAvailable() {
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" -> LocalTransportFixture.Response(
                    """{"_id":"fictional-member-id","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                request.method == "GET" && request.path == "/api/contacts/fictional-member-id" -> null
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        var invalidations = 0
        compose.setContent {
            TrustrootsTheme {
                ContactsScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session(),
                    onSessionInvalidated = { invalidations++ },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        awaitTransportError(setOf("Contacts", "Back"))
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        compose.onNodeWithText("People you connect with on Trustroots will appear here.").assertDoesNotExist()
        assertEquals(0, invalidations)
        assertEquals(
            listOf("/api/users/steady-heron", "/api/contacts/fictional-member-id"),
            local.requests.map { it.path }.distinct(),
        )
        assertTrue(local.requests.all { it.method == "GET" })
    }

    private fun startFixture(respond: (LocalTransportFixture.Request) -> LocalTransportFixture.Response?): LocalTransportFixture =
        LocalTransportFixture(respond).also { fixture = it }

    private fun session() = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )

    private fun awaitTransportError(knownLabels: Set<String>) {
        compose.waitUntil(10_000) {
            val loading = compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
                .fetchSemanticsNodes().isNotEmpty()
            val errorText = compose.onAllNodes(
                SemanticsMatcher("non-empty text outside the screen's fixed labels") { node ->
                    node.config.contains(SemanticsProperties.Text) &&
                        node.config[SemanticsProperties.Text].any { it.text.isNotBlank() && it.text !in knownLabels }
                },
            ).fetchSemanticsNodes().isNotEmpty()
            !loading && errorText
        }
    }
}
