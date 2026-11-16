package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.SecureMobileSessionStore
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicInteger

@RunWith(AndroidJUnit4::class)
class SharedMemberPilotJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private var fixture: LocalTransportFixture? = null
    private val sessions by lazy { SecureMobileSessionStore(context) }
    private var previousSession = sessions.load()
    private val draftKey = MessageDraftStore.cacheKey("steady-heron", "quiet-fox")
    private var previousDraft: String? = null
    private var hadPreviousDraft = false

    @After fun restoreSessionAndCloseFixture() {
        scenario?.close()
        fixture?.close()
        if (previousSession == null) sessions.clear() else sessions.save(previousSession!!)
        if (hadPreviousDraft) {
            context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE).edit()
                .putString(draftKey, previousDraft).commit()
        } else {
            context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE).edit().remove(draftKey).commit()
        }
    }

    @Test fun sharedPilotSignsInProfilesReadsInboxPreservesRejectedDraftAndReturnsToNativeShell() {
        sessions.clear()
        val savedDrafts = context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE)
        hadPreviousDraft = savedDrafts.contains(draftKey)
        previousDraft = savedDrafts.getString(draftKey, null)
        savedDrafts.edit().remove(draftKey).commit()
        val sends = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "POST" && request.path == "/api/mobile/v0/auth/signin" ->
                    LocalTransportFixture.Response(
                        """{"accessToken":"pilot-access","refreshToken":"pilot-refresh","member":{"username":"steady-heron","displayName":"Steady Heron"}}""",
                    )
                request.path == "/api/mobile/v0/profiles/steady-heron" -> LocalTransportFixture.Response(
                    """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","tagline":"A fictional welcome.","location":"Lisbon"}""",
                )
                request.path == "/api/mobile/v0/messages?page=1&limit=50" -> LocalTransportFixture.Response(
                    """[{"_id":"thread-fox","updated":"2099-01-01T00:00:00Z","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional hello."},"read":false}]""",
                )
                request.path == "/api/mobile/v0/profiles/quiet-fox" -> LocalTransportFixture.Response(
                    """{"profile":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A fictional neighbour.","location":"Porto","description":"A friendly fictional profile."}}""",
                )
                request.path == "/api/mobile/v0/messages/member-fox?limit=100" -> LocalTransportFixture.Response(
                    """[{"_id":"message-fox","content":"A fictional question.","created":"${Instant.parse("2025-03-04T05:06:07Z")}","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                )
                request.method == "POST" && request.path == "/api/mobile/v0/messages" -> {
                    if (sends.incrementAndGet() == 1) LocalTransportFixture.Response(
                        """{"message":"A fictional delivery failure."}""",
                        status = 503,
                    ) else LocalTransportFixture.Response(
                        """{"_id":"message-reply","content":"A saved fictional reply.","userFrom":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}}""",
                    )
                }
                request.path == "/api/tribes?limit=150" || request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("{}", status = 404)
                else -> LocalTransportFixture.Response("[]")
            }
        }.also { fixture = it }
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SHARED_MEMBER_PILOT_EXTRA, true)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, local.baseURL),
        )

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("pilot-username").performTextReplacement("steady-heron")
        compose.onNodeWithTag("pilot-password").performTextReplacement("fictional-password")
        compose.onNode(hasText("Sign in") and hasClickAction()).performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional welcome.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional welcome.").assertIsDisplayed()
        compose.onNodeWithText("Messages").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional hello.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("View profile").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A friendly fictional profile.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Send a message").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional question.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("pilot-draft").performTextReplacement("A saved fictional reply.")
        compose.onNodeWithText("Send reply").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional delivery failure.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("pilot-draft").assertTextEquals("A saved fictional reply.")
        assertEquals("A saved fictional reply.", savedDrafts.getString(draftKey, null))

        compose.onNodeWithText("Send reply").performClick()
        compose.waitUntil("the retry reaches the message endpoint", 10_000) { sends.get() >= 2 }
        compose.waitUntil(10_000) {
            runCatching { compose.onNodeWithTag("pilot-draft").assertTextEquals("") }.isSuccess &&
                compose.onAllNodesWithText("A saved fictional reply.").fetchSemanticsNodes().size == 1
        }
        compose.onNodeWithTag("pilot-draft").assertTextEquals("")
        compose.onAllNodesWithText("A saved fictional reply.").assertCountEquals(1)
        assertNull(savedDrafts.getString(draftKey, null))
        assertEquals(2, sends.get())
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithText("Open native app").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        assertNotNull(sessions.load())
        assertEquals("steady-heron", sessions.load()?.member?.username)
        val signInRequest = local.requests.single { it.path == "/api/mobile/v0/auth/signin" }
        assertEquals("POST", signInRequest.method)
        assertEquals("steady-heron", JSONObject(signInRequest.body).getString("username"))
        assertEquals("fictional-password", JSONObject(signInRequest.body).getString("password"))
        assertNull(signInRequest.authorization)
        assertEquals(3, local.requests.count { it.method == "POST" })
        assertEquals(2, local.requests.count { it.method == "POST" && it.path == "/api/mobile/v0/messages" })
        val messagePosts = local.requests.filter { it.method == "POST" && it.path == "/api/mobile/v0/messages" }
        assertTrue(messagePosts.all { it.authorization == "Bearer pilot-access" && it.cookie == null })
        assertTrue(messagePosts.all {
            JSONObject(it.body).getString("userTo") == "member-fox" &&
                JSONObject(it.body).getString("content") == "A saved fictional reply."
        })
        assertTrue(local.requests.filter { it.path != "/api/mobile/v0/auth/signin" }
            .all { it.authorization == "Bearer pilot-access" && it.cookie == null })
        assertTrue(local.requests.any { it.path == "/api/mobile/v0/profiles/steady-heron" })
        assertTrue(local.requests.any { it.path == "/api/mobile/v0/messages?page=1&limit=50" })
    }
}
