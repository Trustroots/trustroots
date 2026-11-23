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
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.SecureMobileSessionStore

@RunWith(AndroidJUnit4::class)
class SharedMemberPilotJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private var fixture: LocalTransportFixture? = null
    private val sessions by lazy { SecureMobileSessionStore(context) }
    private val previousSession = sessions.load()
    private val draftKey = MessageDraftStore.cacheKey("steady-heron", "quiet-fox")
    private val savedDrafts = context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE)
    private var previousDraft: String? = null
    private var restoreDraft = false

    @After fun restoreSessionAndCloseFixture() {
        scenario?.close()
        fixture?.close()
        if (previousSession == null) sessions.clear() else sessions.save(previousSession)
        if (restoreDraft) {
            savedDrafts.edit().putString(draftKey, previousDraft).commit()
        }
    }

    @Test fun sharedPilotSignsInProfilesReadsInboxPreservesRejectedDraftAndReturnsToNativeShell() {
        sessions.clear()
        restoreDraft = true
        previousDraft = savedDrafts.getString(draftKey, null)
        savedDrafts.edit().remove(draftKey).commit()
        val sends = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "POST" && request.path == "/api/mobile/v0/auth/signin" ->
                    LocalTransportFixture.Response(
                        """{"accessToken":"pilot-access","refreshToken":"pilot-refresh","member":{"username":"steady-heron","displayName":"Steady Heron"}}""",
                    )
                request.path == "/api/nostr/featured-notes" -> LocalTransportFixture.Response(
                    """[{"id":"update-one","content":"A fictional Trustroots update.","authorUsername":"news-team","publishedAt":"2026-03-03T10:00:00Z"}]""",
                )
                request.path == "/api/mobile/v0/connections" -> LocalTransportFixture.Response(
                    """{"recent":[{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","activity":"today"}],
                        "hosts":[{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","location":[41.15,-8.61]}],
                        "meetings":[{"_id":"member-wren","username":"calm-wren","displayName":"Calm Wren","location":[48.86,2.35]}]}""",
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
        launchPilot(local)
        signIn()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Home").fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional Trustroots update.").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("Quiet Fox · Active today").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional Trustroots update.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Connections on the map").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("pilot-connections-map").performScrollTo().assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_shared_dashboard_map")
        compose.onNodeWithText("Calm Wren · Happy to meet").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox · Hosting").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox · Active today").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A friendly fictional profile.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithText("My profile").assertIsDisplayed().performClick()
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
        compose.onNode(hasText("Home") and !hasClickAction()).assertIsDisplayed()
        compose.onNodeWithText("Exit shared pilot").performClick()
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
        assertTrue(local.requests.filter { it.path !in setOf("/api/mobile/v0/auth/signin", "/api/nostr/featured-notes") }
            .all { it.authorization == "Bearer pilot-access" && it.cookie == null })
        assertTrue(local.requests.any { it.path == "/api/mobile/v0/profiles/steady-heron" })
        assertTrue(local.requests.any { it.path == "/api/mobile/v0/messages?page=1&limit=50" })
    }

    @Test fun rejectedRefreshClearsTheSavedSessionAndKeepsThePilotSignedOutAfterRelaunch() {
        sessions.clear()
        val inboxPath = "/api/mobile/v0/messages?page=1&limit=50"
        val refreshPath = "/api/mobile/v0/auth/refresh"
        val local = LocalTransportFixture { request ->
            when {
                request.method == "POST" && request.path == "/api/mobile/v0/auth/signin" ->
                    LocalTransportFixture.Response(
                        """{"accessToken":"pilot-access","refreshToken":"pilot-refresh","member":{"username":"steady-heron","displayName":"Steady Heron"}}""",
                    )
                request.path == "/api/mobile/v0/profiles/steady-heron" && request.authorization == "Bearer pilot-access" ->
                    LocalTransportFixture.Response(
                        """{"profile":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","tagline":"A fictional welcome."}}""",
                    )
                request.path == inboxPath || request.path == refreshPath ->
                    LocalTransportFixture.Response("""{"code":"authentication_required"}""", status = 401)
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }

        launchPilot(local)
        signIn()
        waitForText("My profile")
        compose.onNodeWithText("My profile").performClick()
        waitForText("A fictional welcome.")
        assertEquals("pilot-refresh", sessions.load()?.refreshToken)

        compose.onNodeWithText("Messages").performClick()
        waitForText(context.getString(R.string.screen_sign_in_session_expired))
        compose.onNodeWithTag("pilot-username").assertIsDisplayed()
        compose.onNodeWithText("Messages").assertDoesNotExist()
        assertNull(sessions.load())
        assertEquals("Bearer pilot-access", local.requests.single { it.path == inboxPath }.authorization)
        val refresh = local.requests.single { it.path == refreshPath }
        assertEquals("POST", refresh.method)
        assertEquals("pilot-refresh", JSONObject(refresh.body).getString("refreshToken"))

        scenario?.close()
        launchPilot(local)
        waitForText("Username or email")
        compose.onNodeWithTag("pilot-username").assertIsDisplayed()
        compose.onNodeWithText("Messages").assertDoesNotExist()
        assertEquals(1, local.requests.count { it.path == refreshPath })
    }

    private fun launchPilot(local: LocalTransportFixture) {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SHARED_MEMBER_PILOT_EXTRA, true)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, local.baseURL),
        )
    }

    private fun signIn() {
        waitForText("Username or email")
        compose.onNodeWithTag("pilot-username").performTextReplacement("steady-heron")
        compose.onNodeWithTag("pilot-password").performTextReplacement("fictional-password")
        compose.onNode(hasText("Sign in") and hasClickAction()).performClick()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }
}
