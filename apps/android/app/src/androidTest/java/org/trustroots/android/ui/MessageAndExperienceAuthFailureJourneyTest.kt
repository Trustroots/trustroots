package org.trustroots.android.ui

import android.content.Context
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.semantics.Role
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
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
import org.trustroots.android.ui.conversation.ConversationScreen

@RunWith(AndroidJUnit4::class)
class MessageAndExperienceAuthFailureJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val draftPreferences by lazy { context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE) }
    private var fixture: LocalTransportFixture? = null
    private var draftKey: String? = null
    private var hadPreviousDraft = false
    private var previousDraft: String? = null

    @After fun closeFixtureAndRestoreDraft() {
        try {
            fixture?.close()
        } finally {
            draftKey?.let { key ->
                if (hadPreviousDraft) draftPreferences.edit().putString(key, previousDraft).commit()
                else draftPreferences.edit().remove(key).commit()
            }
            draftKey = null
        }
    }

    @Test fun unauthorizedMessageSendKeepsDraftAndInvalidatesSession() {
        val author = "message-author"
        val recipient = "fictional-recipient"
        val recipientID = "member-recipient"
        val key = "messages.thread.$author-$recipient"
        draftKey = key
        hadPreviousDraft = draftPreferences.contains(key)
        previousDraft = draftPreferences.getString(key, null)
        draftPreferences.edit().remove(key).commit()

        val invalidations = AtomicInteger()
        val draft = "A fictional reply awaiting a valid session."
        val apiFixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/$recipientID?limit=100" ->
                    LocalTransportFixture.Response("[]")
                request.method == "POST" && request.path == "/api/messages" ->
                    LocalTransportFixture.Response(
                        """{"message":"Please sign in again."}""",
                        status = 401,
                    )
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                ConversationScreen(
                    api = MobileApiClient(apiFixture.baseURL),
                    session = MemberSession(
                        "connect.sid=fictional-message-session",
                        MobileMember(author, "Fictional Author"),
                    ),
                    member = MessageMember(recipientID, recipient, "Fictional Recipient"),
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            apiFixture.requests.any { it.method == "GET" && it.path == "/api/messages/$recipientID?limit=100" }
        }
        compose.onNodeWithTag("messageComposer").performTextInput(draft)
        compose.onNodeWithContentDescription("Send").assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            invalidations.get() == 1 &&
                apiFixture.requests.any { it.method == "POST" && it.path == "/api/messages" } &&
                runCatching { compose.onNodeWithContentDescription("Send").assertIsEnabled() }.isSuccess
        }

        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(draft)),
        )
        compose.onAllNodesWithText(draft).assertCountEquals(1)
        compose.onNodeWithText("Please sign in again.").assertDoesNotExist()
        assertEquals(draft, draftPreferences.getString(key, null))
        assertEquals(1, invalidations.get())

        val requests = apiFixture.requests.filter { it.path.startsWith("/api/messages") }
        assertEquals(listOf("GET", "POST"), requests.map { it.method })
        assertEquals("/api/messages", requests.last().path)
        assertEquals("connect.sid=fictional-message-session", requests.last().cookie)
        val payload = JSONObject(requests.last().body)
        assertEquals(recipientID, payload.getString("userTo"))
        assertEquals(draft, payload.getString("content"))
    }

    @Test fun unauthorizedExperienceCreationKeepsFieldsAndDoesNotNavigate() {
        val invalidations = AtomicInteger()
        val created = AtomicInteger()
        val feedback = "A fictional meeting shared with care."
        val apiFixture = LocalTransportFixture { request ->
            if (request.method == "POST" && request.path == "/api/experiences") {
                LocalTransportFixture.Response(
                    """{"message":"Please sign in again."}""",
                    status = 401,
                )
            } else {
                error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                CreateExperienceScreen(
                    api = MobileApiClient(apiFixture.baseURL),
                    session = MemberSession(
                        "connect.sid=fictional-experience-session",
                        MobileMember("experience-author", "Fictional Author"),
                    ),
                    memberID = "member-recipient",
                    memberLabel = "Fictional Recipient",
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = {},
                    onCreated = { created.incrementAndGet() },
                )
            }
        }

        val checkbox = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox)
        compose.onAllNodes(checkbox)[0].performClick()
        compose.onAllNodes(checkbox)[1].performClick()
        compose.onNodeWithText("Not sure").performClick()
        compose.onNodeWithText("Public experience (optional)")
            .performScrollTo()
            .performTextReplacement(feedback)
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            invalidations.get() == 1 &&
                apiFixture.requests.any { it.method == "POST" && it.path == "/api/experiences" } &&
                runCatching { compose.onNodeWithText("Save changes").assertIsEnabled() }.isSuccess
        }

        compose.onNodeWithText("Experience with Fictional Recipient").assertIsDisplayed()
        compose.onNodeWithText("We met in person").performScrollTo()
        compose.onAllNodes(checkbox)[0].assertIsOff()
        compose.onAllNodes(checkbox)[1].assertIsOn()
        compose.onNodeWithText("Not sure").assertIsSelected()
        compose.onNodeWithText(feedback).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Please sign in again.").assertDoesNotExist()
        assertEquals(1, invalidations.get())
        assertEquals(0, created.get())

        val request = apiFixture.requests.single()
        assertEquals("POST", request.method)
        assertEquals("/api/experiences", request.path)
        assertEquals("connect.sid=fictional-experience-session", request.cookie)
        val payload = JSONObject(request.body)
        assertEquals("member-recipient", payload.getString("userTo"))
        assertEquals(feedback, payload.getString("feedbackPublic"))
        assertTrue(payload.getJSONObject("interactions").getBoolean("host"))
        assertEquals(false, payload.getJSONObject("interactions").getBoolean("met"))
    }
}
