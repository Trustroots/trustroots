package org.trustroots.android.ui

import android.content.Context
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.AnnotatedString
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
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
import org.trustroots.android.ui.membersearch.MemberSearchScreen
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class SearchProfileAndSendTransportJourneysTest {
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
            fixture = null
            draftKey?.let { key ->
                if (hadPreviousDraft) draftPreferences.edit().putString(key, previousDraft).commit()
                else draftPreferences.edit().remove(key).commit()
            }
            draftKey = null
        }
    }

    @Test fun memberSearchTransportFailureWaitsForExplicitRetryThenRecovers() {
        val allowRecovery = AtomicBoolean(false)
        val recoveryResponses = AtomicInteger()
        val path = "/api/users?search=quiet+fox&limit=50"
        val local = startFixture { request ->
            if (request.method == "GET" && request.path == path) {
                if (!allowRecovery.get()) null
                else {
                    recoveryResponses.incrementAndGet()
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-member","username":"quiet-fox","displayName":"Quiet Fox"}]""",
                    )
                }
            } else {
                LocalTransportFixture.Response("{}", status = 404)
            }
        }
        val invalidations = AtomicInteger()
        compose.setContent {
            TrustrootsTheme {
                MemberSearchScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session("search-author"),
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }

        compose.onNodeWithText("Name or username").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        val transportError = awaitTransportFailure(setOf("Name or username"))
        compose.onNodeWithText(transportError).assertIsDisplayed()
        assertEquals(0, invalidations.get())
        assertTrue(local.requests.any { it.path == path })

        allowRecovery.set(true)
        compose.onNodeWithContentDescription("Search members").assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            recoveryResponses.get() == 1 &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText(transportError).assertDoesNotExist()
        assertEquals(0, invalidations.get())
        assertEquals(1, recoveryResponses.get())
        val searchRequests = local.requests.filter { it.path.startsWith("/api/users?") }
        assertTrue(searchRequests.isNotEmpty())
        assertTrue(searchRequests.all { it.method == "GET" && it.path == path && it.cookie == "connect.sid=search-author-session" })
    }

    @Test fun memberProfileTransportFailureShowsBackActionWithoutInvalidatingSession() {
        val path = "/api/users/quiet-fox"
        val local = startFixture { request ->
            if (request.method == "GET" && request.path == path) null
            else LocalTransportFixture.Response("{}", status = 404)
        }
        val invalidations = AtomicInteger()
        var backCount = 0
        compose.setContent {
            TrustrootsTheme {
                MemberProfileScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session("profile-author"),
                    username = "quiet-fox",
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = { backCount++ },
                )
            }
        }

        val transportError = awaitTransportFailure(setOf("Back"))
        compose.onNodeWithText(transportError).assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").assertIsDisplayed().performClick()
        assertEquals(1, backCount)
        assertEquals(0, invalidations.get())
        assertTrue(local.requests.isNotEmpty())
        assertTrue(local.requests.all { it.method == "GET" && it.path == path && it.cookie == "connect.sid=profile-author-session" })
    }

    @Test fun failedMessageTransportKeepsDraftUntilExplicitRetrySucceeds() {
        val author = "transport-author"
        val recipient = "transport-recipient"
        val key = "messages.thread.$author-$recipient"
        draftKey = key
        hadPreviousDraft = draftPreferences.contains(key)
        previousDraft = draftPreferences.getString(key, null)
        draftPreferences.edit().remove(key).commit()

        val allowRecovery = AtomicBoolean(false)
        val recoveryPosts = AtomicInteger()
        val draft = "A fictional reply after a transport interruption."
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/mini/fictional-recipient-id" ->
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-recipient-id","username":"$recipient","displayName":"Fictional Recipient"}""",
                    )
                request.method == "GET" && request.path == "/api/messages/fictional-recipient-id?limit=100" ->
                    LocalTransportFixture.Response("[]")
                request.method == "POST" && request.path == "/api/messages" -> {
                    if (!allowRecovery.get()) null
                    else {
                        recoveryPosts.incrementAndGet()
                        LocalTransportFixture.Response(
                            """{"_id":"fictional-message","content":"$draft","created":"${Instant.parse("2025-02-03T04:05:06Z")}","userFrom":{"_id":"fictional-author-id","username":"$author","displayName":"Fictional Author"}}""",
                        )
                    }
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        val invalidations = AtomicInteger()
        compose.setContent {
            TrustrootsTheme {
                ConversationRouteTestHarness(
                    api = MobileApiClient(local.baseURL),
                    session = session(author),
                    memberID = "fictional-recipient-id",
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/messages/fictional-recipient-id?limit=100" }
        }
        compose.onNodeWithTag("messageComposer").performTextInput(draft)
        compose.onNodeWithContentDescription("Send").assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("conversationFailure").fetchSemanticsNodes().isNotEmpty()
        }
        val transportError = compose.onNodeWithTag("conversationFailure")
            .fetchSemanticsNode().config[SemanticsProperties.Text].first().text
        compose.onNodeWithText(transportError).assertIsDisplayed()
        compose.onNodeWithTag("messageComposer").assertIsDisplayed()
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithContentDescription("Send").assertIsEnabled() }.isSuccess
        }
        assertComposerText(draft)
        assertEquals(draft, draftPreferences.getString(key, null))
        assertEquals(0, invalidations.get())

        allowRecovery.set(true)
        compose.onNodeWithContentDescription("Send").assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            recoveryPosts.get() == 1 &&
                compose.onAllNodesWithText(draft).fetchSemanticsNodes().isNotEmpty() &&
                draftPreferences.getString(key, null) == null
        }
        assertTrue(compose.onAllNodesWithText(draft).fetchSemanticsNodes().isNotEmpty())
        assertComposerText("")
        compose.onNodeWithText(transportError).assertDoesNotExist()
        assertEquals(0, invalidations.get())
        assertEquals(1, recoveryPosts.get())
        val apiRequests = local.requests.filter { it.path.startsWith("/api/messages") }
        assertTrue(apiRequests.all { it.cookie == "connect.sid=$author-session" })
        val posts = apiRequests.filter { it.method == "POST" }
        assertTrue(posts.size >= 2)
        posts.forEach { request ->
            val body = org.json.JSONObject(request.body)
            assertEquals("fictional-recipient-id", body.getString("userTo"))
            assertEquals(draft, body.getString("content"))
        }
    }

    private fun startFixture(respond: (LocalTransportFixture.Request) -> LocalTransportFixture.Response?): LocalTransportFixture =
        LocalTransportFixture(respond).also { fixture = it }

    private fun session(username: String) = MemberSession(
        "connect.sid=$username-session",
        MobileMember(username, "Fictional Author"),
    )

    private fun assertComposerText(expected: String) {
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(expected)),
        )
    }

    private fun awaitTransportFailure(knownLabels: Set<String>): String {
        val errorMatcher = SemanticsMatcher("transport error text") { node ->
            val config = node.config
            SemanticsProperties.Text in config && config[SemanticsProperties.Text]
                .any { it.text.isNotBlank() && it.text !in knownLabels }
        }
        compose.waitUntil(10_000) {
            val loading = compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
                .fetchSemanticsNodes().isNotEmpty()
            !loading && compose.onAllNodes(errorMatcher).fetchSemanticsNodes().isNotEmpty()
        }
        val errorNode = compose.onAllNodes(errorMatcher).fetchSemanticsNodes().first()
        return errorNode.config[SemanticsProperties.Text].first().text
    }
}
