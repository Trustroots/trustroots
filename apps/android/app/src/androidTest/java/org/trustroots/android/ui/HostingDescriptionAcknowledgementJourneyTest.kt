package org.trustroots.android.ui

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.conversation.ConversationScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HostingDescriptionAcknowledgementJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val draftKey = "messages.thread.steady-heron-kind-otter"
    private val preferences by lazy { context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE) }
    private var fixture: LocalTransportFixture? = null
    private var previousDraft: String? = null
    private var hadPreviousDraft = false

    @Before fun clearFixtureDraft() {
        hadPreviousDraft = preferences.contains(draftKey)
        previousDraft = preferences.getString(draftKey, null)
        preferences.edit().remove(draftKey).commit()
    }

    @After fun closeFixtureAndRestoreDraft() {
        try {
            fixture?.close()
            fixture = null
        } finally {
            val edit = preferences.edit()
            if (hadPreviousDraft) edit.putString(draftKey, previousDraft) else edit.remove(draftKey)
            edit.commit()
        }
    }

    @Test fun ordinaryMessageDoesNotLoadContextOrRequireAcknowledgement() {
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/member-host?limit=100" -> LocalTransportFixture.Response("[]")
                request.method == "POST" && request.path == "/api/messages" -> messageResponse("Hello there.")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }
        openConversation(local)
        compose.onNodeWithTag("messageComposer").performTextInput("Hello there.")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) { local.requests.any { it.method == "POST" } }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("outgoingMessage").fetchSemanticsNodes().isNotEmpty() }
        val body = JSONObject(local.requests.single { it.method == "POST" }.body)
        assertFalse(body.has("hostingDetails"))
        assertFalse(body.has("hostingDescriptionAcknowledged"))
        assertTrue(local.requests.none { it.path.startsWith("/api/messages-hosting?") })
    }

    @Test fun hostingMessageLoadsContextRequiresAcknowledgementAndRendersDetails() {
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/member-host?limit=100" -> LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/messages-hosting?userTo=member-host" -> LocalTransportFixture.Response(
                    """{"description":"<p>Room in a shared home.</p>","acknowledgementRequired":true}""",
                )
                request.method == "POST" && request.path == "/api/messages" -> LocalTransportFixture.Response(
                    """{"_id":"message-one","content":"Visiting soon.","userFrom":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"hostingDetails":{"guests":2,"arrival":"2027-05-01","departure":"2027-05-04"}}""",
                )
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }
        openConversation(local)
        compose.onNodeWithTag("hostingModeToggle").performClick()
        compose.waitUntil(10_000) { local.requests.any { it.path == "/api/messages-hosting?userTo=member-host" } }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("hostingGuests").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Room in a shared home.").assertIsDisplayed()
        compose.onNodeWithText("I have read this host’s hosting description and requirements.").assertIsDisplayed()
        compose.onNodeWithTag("messageComposer").performTextInput("Visiting soon.")
        compose.onNodeWithContentDescription("Send").assertIsNotEnabled()
        compose.onNodeWithTag("hostingDescriptionAcknowledgement").performClick()
        compose.onNodeWithTag("hostingGuests").performTextReplacement("2")
        compose.onNodeWithText("Arrival (YYYY-MM-DD)").performTextReplacement("2027-05-01")
        compose.onNodeWithText("Departure (YYYY-MM-DD)").performTextReplacement("2027-05-04")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) { local.requests.any { it.method == "POST" } }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("2 guests").fetchSemanticsNodes().isNotEmpty() }

        val sent = JSONObject(local.requests.single { it.method == "POST" }.body)
        assertEquals(2, sent.getJSONObject("hostingDetails").getInt("guests"))
        assertEquals("2027-05-01", sent.getJSONObject("hostingDetails").getString("arrival"))
        assertTrue(sent.getBoolean("hostingDescriptionAcknowledged"))
        compose.onNodeWithText("2 guests").assertIsDisplayed()
        compose.onNodeWithText("2027-05-01 – 2027-05-04").assertIsDisplayed()
    }

    @Test fun staleAcknowledgementRefreshKeepsMessageAndVisitDetails() {
        val contextCalls = AtomicInteger()
        val posts = AtomicInteger()
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/member-host?limit=100" -> LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/messages-hosting?userTo=member-host" -> {
                    val acknowledged = contextCalls.incrementAndGet() > 1
                    LocalTransportFixture.Response(
                        """{"description":"Updated hosting details.","acknowledgementRequired":$acknowledged}""",
                    )
                }
                request.method == "POST" && request.path == "/api/messages" -> {
                    if (posts.incrementAndGet() == 1) {
                        LocalTransportFixture.Response(
                            """{"error":"hosting-description-acknowledgement-required","message":"Please acknowledge."}""",
                            status = 400,
                        )
                    } else {
                        LocalTransportFixture.Response(
                            """{"_id":"message-one","content":"Fictional visit request.","userFrom":{"_id":"member-self","username":"steady-heron"},"hostingDetails":{"guests":3,"arrival":"2027-05-01","departure":"2027-05-04"}}""",
                        )
                    }
                }
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }
        openConversation(local)
        compose.onNodeWithTag("hostingModeToggle").performClick()
        compose.waitUntil(10_000) { contextCalls.get() == 1 }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("hostingGuests").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("messageComposer").performTextInput("Fictional visit request.")
        compose.onNodeWithTag("hostingGuests").performTextReplacement("3")
        compose.onNodeWithText("Arrival (YYYY-MM-DD)").performTextReplacement("2027-05-01")
        compose.onNodeWithText("Departure (YYYY-MM-DD)").performTextReplacement("2027-05-04")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) { posts.get() == 1 && contextCalls.get() == 2 }

        compose.onNodeWithTag("messageComposer").assertTextContains("Fictional visit request.")
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("hostingDescriptionAcknowledgement").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("hostingDescriptionAcknowledgement").assertIsOff().performClick()
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) { posts.get() == 2 }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("3 guests").fetchSemanticsNodes().isNotEmpty() }
        val sent = JSONObject(local.requests.filter { it.method == "POST" }.last().body)
        assertTrue(sent.getBoolean("hostingDescriptionAcknowledged"))
        assertEquals(3, sent.getJSONObject("hostingDetails").getInt("guests"))
        assertEquals("2027-05-01", sent.getJSONObject("hostingDetails").getString("arrival"))
        assertEquals("Fictional visit request.", sent.getString("content"))
    }

    @Test fun failedContextCanRetryOrSwitchBackToOrdinarySend() {
        val contextCalls = AtomicInteger()
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/member-host?limit=100" -> LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/messages-hosting?userTo=member-host" -> {
                    if (contextCalls.incrementAndGet() == 1) LocalTransportFixture.Response("{}", status = 503)
                    else LocalTransportFixture.Response("""{"description":"Hosting details.","acknowledgementRequired":false}""")
                }
                request.method == "POST" && request.path == "/api/messages" -> messageResponse("Ordinary note.")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }
        openConversation(local)
        compose.onNodeWithTag("hostingModeToggle").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Retry").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Retry").performClick()
        compose.waitUntil(10_000) { contextCalls.get() == 2 }
        compose.onNodeWithTag("hostingModeToggle").performClick()
        compose.onNodeWithTag("messageComposer").performTextInput("Ordinary note.")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitUntil(10_000) { local.requests.any { it.method == "POST" } }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("outgoingMessage").fetchSemanticsNodes().isNotEmpty() }
        val sent = JSONObject(local.requests.single { it.method == "POST" }.body)
        assertFalse(sent.has("hostingDetails"))
        assertFalse(sent.has("hostingDescriptionAcknowledged"))
    }

    private fun startFixture(respond: (LocalTransportFixture.Request) -> LocalTransportFixture.Response?): LocalTransportFixture =
        LocalTransportFixture(respond).also { fixture = it }

    private fun openConversation(local: LocalTransportFixture) {
        compose.setContent {
            TrustrootsTheme {
                ConversationScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                    member = MessageMember("member-host", "kind-otter", "Kind Otter"),
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
        }
        compose.waitUntil(10_000) { local.requests.any { it.path == "/api/messages/member-host?limit=100" } }
    }

    private fun messageResponse(content: String) = LocalTransportFixture.Response(
        """{"_id":"message-one","content":"$content","userFrom":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}}""",
    )
}
