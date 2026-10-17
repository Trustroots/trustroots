package org.trustroots.android.ui

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.AnnotatedString
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ConversationPendingSendJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val preferences by lazy { context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE) }
    private val draftKey = "messages.thread.steady-heron-quiet-fox"
    private val responseStarted = CountDownLatch(1)
    private val releaseResponse = CountDownLatch(1)
    private var previousDraft: String? = null
    private var hadPreviousDraft = false
    private var fixture: LocalTransportFixture? = null

    @Before fun backUpAndClearDraft() {
        hadPreviousDraft = preferences.contains(draftKey)
        previousDraft = preferences.getString(draftKey, null)
        preferences.edit().remove(draftKey).commit()
    }

    @After fun restoreDraftAndCloseFixture() {
        releaseResponse.countDown()
        try {
            fixture?.close()
        } finally {
            if (hadPreviousDraft) preferences.edit().putString(draftKey, previousDraft).commit()
            else preferences.edit().remove(draftKey).commit()
        }
    }

    @Test fun keepsDraftAndDisablesMessageActionsUntilPendingSendSucceeds() {
        val draft = "A fictional reply waiting for delivery."
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/messages/fictional-neighbour?limit=100" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-incoming","content":"Can you host?","userFrom":{"_id":"fictional-neighbour","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                    )
                request.method == "POST" && request.path == "/api/messages" -> {
                    responseStarted.countDown()
                    check(releaseResponse.await(15, TimeUnit.SECONDS)) {
                        "Timed out waiting to release the pending message response"
                    }
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-outgoing","content":${JSONObject.quote(draft)},"created":"${Instant.now()}","userFrom":{"_id":"fictional-self","username":"steady-heron","displayName":"Steady Heron"}}""",
                    )
                }
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        compose.setContent {
            ConversationScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                member = MessageMember("fictional-neighbour", "quiet-fox", "Quiet Fox"),
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/messages/fictional-neighbour?limit=100" } &&
                compose.onNodeWithText("Yes, I can host!").fetchSemanticsNodeOrNull() != null
        }
        compose.onNodeWithTag("messageComposer").performTextInput(draft)
        compose.waitUntil(5_000) { preferences.getString(draftKey, null) == draft }
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(draft)),
        )
        compose.onNodeWithContentDescription("Send").performClick()

        assertTrue("The fixture should receive the POST", responseStarted.await(10, TimeUnit.SECONDS))
        compose.waitUntil(10_000) {
            compose.onNodeWithContentDescription("Sending…").fetchSemanticsNodeOrNull() != null
        }
        compose.onNodeWithContentDescription("Sending…").assertIsDisplayed().assertIsNotEnabled()
        compose.onNodeWithText("Yes, I can host!").assertIsNotEnabled()
        compose.onNodeWithText("Sorry I can't host").assertIsNotEnabled()
        compose.onNodeWithText("Write back").assertIsNotEnabled()
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(draft)),
        )
        assertEquals(draft, preferences.getString(draftKey, null))

        releaseResponse.countDown()
        compose.waitUntil(10_000) {
            compose.onNodeWithText(draft).fetchSemanticsNodeOrNull() != null &&
                compose.onNodeWithTag("messageComposer").fetchSemanticsNodeOrNull()
                    ?.config?.getOrNull(SemanticsProperties.EditableText)?.text == "" &&
                !preferences.contains(draftKey)
        }
        compose.onNodeWithText(draft).assertIsDisplayed()
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString("")),
        )
        compose.waitForIdle()

        val posts = local.requests.filter { it.method == "POST" && it.path == "/api/messages" }
        assertEquals(1, posts.size)
        assertEquals("connect.sid=fictional-session", posts.single().cookie)
        val payload = JSONObject(posts.single().body)
        assertEquals("fictional-neighbour", payload.getString("userTo"))
        assertEquals(draft, payload.getString("content"))
        assertFalse(preferences.contains(draftKey))
    }
}

private fun androidx.compose.ui.test.SemanticsNodeInteraction.fetchSemanticsNodeOrNull() =
    runCatching { fetchSemanticsNode() }.getOrNull()
