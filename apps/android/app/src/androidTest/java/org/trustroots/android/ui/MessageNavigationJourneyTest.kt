package org.trustroots.android.ui

import androidx.compose.ui.test.performScrollTo

import androidx.compose.ui.test.onAllNodesWithTag

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedDispatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination

@RunWith(AndroidJUnit4::class)
class MessageNavigationJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private val draftPreferences by lazy { context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE) }
    private lateinit var previousDraftPreferences: Map<String, *>
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousAlertStatus: String? = null
    private var previousAlertDestination: MessageDestination? = null
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private val inboxRequests = AtomicInteger()
    private val recipientLookups = AtomicInteger()
    private val profileLookups = AtomicInteger()
    private val conversationReads = AtomicInteger()
    private val emptyInbox = AtomicBoolean(false)
    private val rejectNextSend = AtomicBoolean(false)
    private val fixture = LocalTransportFixture { request ->
        when {
            request.method == "POST" && request.path == "/api/auth/signin" -> LocalTransportFixture.Response(
                """{"username":"steady-heron","displayName":"Steady Heron"}""",
                headers = mapOf("Set-Cookie" to "connect.sid=renewed-fictional-session; Path=/; HttpOnly"),
            )
            request.path == "/api/users/steady-heron" -> LocalTransportFixture.Response(
                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
            )
            request.path == "/api/users/quiet-fox" -> {
                profileLookups.incrementAndGet()
                LocalTransportFixture.Response(
                    """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}""",
                )
            }
            request.path == "/api/users/mini/member-fox" -> {
                recipientLookups.incrementAndGet()
                LocalTransportFixture.Response(
                    """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}""",
                )
            }
            request.path.startsWith("/api/messages?") -> {
                inboxRequests.incrementAndGet()
                if (emptyInbox.get()) {
                    LocalTransportFixture.Response("[]")
                } else LocalTransportFixture.Response(
                    """[
                        {"_id":"thread-fox","userFrom":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"userTo":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"},"message":{"excerpt":"Fictional trail note"},"read":true}
                    ]""",
                )
            }
            request.path == "/api/messages/member-fox?limit=100" -> {
                conversationReads.incrementAndGet()
                LocalTransportFixture.Response(
                    """[{"_id":"message-fox","content":"Fictional route message","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                )
            }
            request.method == "POST" && request.path == "/api/messages" ->
                if (rejectNextSend.compareAndSet(true, false)) {
                    LocalTransportFixture.Response("""{"message":"Please sign in again."}""", 401)
                } else {
                    LocalTransportFixture.Response("{}")
                }
            request.path.startsWith("/api/tribes?limit=150") -> LocalTransportFixture.Response("[]")
            request.path == "/api/users/memberships" -> LocalTransportFixture.Response("[]")
            request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response("""{"features":[]}""")
            request.path.contains("/avatar?") -> LocalTransportFixture.Response("", 404)
            else -> LocalTransportFixture.Response("[]")
        }
    }

    @Before fun saveAndClearShellState() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDraftPreferences = draftPreferences.all
        draftPreferences.edit().clear().commit()
        previousAlertStatus = MessageAlerts.status.value
        previousAlertDestination = MessageAlerts.destination.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        inboxRequests.set(0)
        recipientLookups.set(0)
        profileLookups.set(0)
        conversationReads.set(0)
        emptyInbox.set(false)
        rejectNextSend.set(false)
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
        )
    }

    @After fun closeScenarioAndRestoreShellState() {
        scenario?.close()
        fixture.close()
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        restorePreferences(draftPreferences, previousDraftPreferences)
        MessageAlerts.destination.value = previousAlertDestination
        MessageAlerts.status.value = previousAlertStatus
    }

    @Test fun conversationAndProfileBackRestoreInboxFilterAndReturnRefreshes() {
        launchMessages()
        waitForText("Quiet Fox")
        compose.waitUntil(10_000) { inboxRequests.get() >= 2 }
        val initialInboxRequests = inboxRequests.get()
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().performTextReplacement("quiet-fox")
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        compose.onNodeWithText("View profile").performClick()
        waitForText("About")
        pressSystemBack()
        compose.onNodeWithText("Fictional route message").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().assertIsDisplayed()
        assertEquals("Returning from the conversation refreshes the inbox once", initialInboxRequests + 1, inboxRequests.get())
        assertTrue(fixture.requests.any { it.path == "/api/users/mini/member-fox" })
        assertTrue(fixture.requests.any { it.path == "/api/users/quiet-fox" })
    }

    @Test fun conversationRouteRestoresAfterActivityRecreationAndMessagesReselectionResetsIt() {
        launchMessages()
        compose.onNodeWithTag("messageInboxFilter").performTextReplacement("quiet-fox")
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        val beforeRecreation = inboxRequests.get()
        val recipientLookupsBeforeRecreation = recipientLookups.get()
        requireNotNull(scenario).recreate()
        waitForText("Fictional route message")
        compose.waitUntil(10_000) { inboxRequests.get() >= beforeRecreation + 1 }
        compose.waitForIdle()
        assertEquals("Activity recreation keeps the Inbox entry's completed load", beforeRecreation + 1, inboxRequests.get())
        assertEquals("A retained Conversation entry does not repeat recipient resolution", recipientLookupsBeforeRecreation, recipientLookups.get())
        pressSystemBack()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        compose.onNodeWithTag("messageInboxFilter").assert(SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString("quiet-fox")))
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        val beforeReselection = inboxRequests.get()
        compose.onNodeWithTag("navigation-messages").performClick()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        compose.onNodeWithTag("messageInboxFilter").assert(SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString("")))
        compose.waitUntil(10_000) { inboxRequests.get() >= beforeReselection + 2 }
    }

    @Test fun populatedMessagesVisitRetainsInboxAndConversationStateAcrossTopLevelDetour() {
        launchMessages()
        waitForText("Quiet Fox")
        compose.waitUntil(10_000) { inboxRequests.get() >= 3 }
        compose.onNodeWithTag("messageInboxFilter").performTextReplacement("quiet-fox")
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        compose.onNodeWithTag("messageComposer").performTextReplacement("A fictional unsent detour note")
        val inboxRequestsBeforeDetour = inboxRequests.get()
        val recipientLookupsBeforeDetour = recipientLookups.get()
        val conversationReadsBeforeDetour = conversationReads.get()

        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Discover circles")
        compose.waitUntil(10_000) { inboxRequests.get() >= inboxRequestsBeforeDetour + 1 }
        pressSystemBack()
        waitForText("Fictional route message")
        compose.waitUntil(10_000) { inboxRequests.get() >= inboxRequestsBeforeDetour + 2 }

        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString("A fictional unsent detour note"),
            ),
        )
        assertEquals("Returning to the retained route does not reload the recipient", recipientLookupsBeforeDetour, recipientLookups.get())
        assertEquals("Returning to the retained route does not reload conversation messages", conversationReadsBeforeDetour, conversationReads.get())
        assertEquals(
            "Only the shell's per-visit unread polls ran during the detour",
            inboxRequestsBeforeDetour + 2,
            inboxRequests.get(),
        )

        pressSystemBack()
        compose.onNodeWithTag("messageInboxFilter").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString("quiet-fox"),
            ),
        )
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
    }

    @Test fun alertOpenedProfileRestoresByUsernameWithAnEmptyInbox() {
        emptyInbox.set(true)
        launchMessages(startOnCircles = true)
        MessageAlerts.destination.value = MessageDestination("steady-heron", "member-fox")
        waitForText("Fictional route message")
        assertEquals("Conversation resolves its member without an Inbox row", 1, recipientLookups.get())

        compose.onNodeWithText("View profile").performClick()
        waitForText("About")
        assertTrue(profileLookups.get() >= 1)
        val profileRequestsBeforeRecreation = profileLookups.get()
        requireNotNull(scenario).recreate()
        waitForText("About")

        assertEquals("The restored profile entry retains its canonical profile", profileRequestsBeforeRecreation, profileLookups.get())
        assertEquals("Activity recreation retains the Conversation recipient", 1, recipientLookups.get())
        pressSystemBack()
        compose.onNodeWithText("Fictional route message").assertIsDisplayed()
    }

    @Test fun predictiveBackCancelsConversationPopThenReturnsThroughInboxToOrigin() {
        assumeTrue("Predictive back event dispatch requires Android 14+", Build.VERSION.SDK_INT >= 34)
        launchMessages(startOnCircles = true)
        MessageAlerts.destination.value = MessageDestination("steady-heron", "member-fox")
        waitForText("Fictional route message")
        cancelPredictiveBack()
        compose.onNodeWithText("Fictional route message").assertIsDisplayed()
        completePredictiveBack()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        completePredictiveBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
    }

    @Test fun alertPushesConversationAboveInboxAndReturnsToPreviousTabOrigin() {
        launchMessages(startOnCircles = true)
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        MessageAlerts.destination.value = MessageDestination("steady-heron", "member-fox")
        waitForText("Fictional route message")
        pressSystemBack()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        pressSystemBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
    }

    @Test fun renewedSameAccountSessionCreatesFreshMessagesEntriesAndUsesNewCookie() {
        launchMessages()
        compose.waitUntil(10_000) { inboxRequests.get() >= 1 }
        compose.onNodeWithTag("messageInboxFilter").performTextReplacement("quiet-fox")
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        assertEquals(1, recipientLookups.get())
        assertEquals(1, conversationReads.get())

        rejectNextSend.set(true)
        compose.onNodeWithTag("messageComposer").performTextReplacement("A fictional reply")
        compose.onNodeWithContentDescription("Send").performClick()
        waitForText("Sign in")
        assertEquals("the failed message send is attempted once", 1, fixture.requests.count {
            it.method == "POST" && it.path == "/api/messages"
        })

        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("signin-username").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("signin-username").performTextReplacement("steady-heron")
        compose.onNodeWithTag("signin-password").performTextReplacement("fictional-renewal-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")
        assertEquals(
            1,
            fixture.requests.count { it.method == "POST" && it.path == "/api/auth/signin" },
        )
        assertEquals("connect.sid=renewed-fictional-session", SecureMobileSessionStore(context).load()?.cookieHeader)
        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithTag("messageInboxFilter").assert(
            SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString("")),
        )
        val inboxReadsBeforeFreshConversation = inboxRequests.get()
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        compose.waitUntil(10_000) { recipientLookups.get() == 2 && conversationReads.get() == 2 }

        // Each session has two shell polls (Circles and Messages) and one Inbox entry load.
        assertEquals("both account graphs load their own Inbox and shell badge", 6, inboxReadsBeforeFreshConversation)
        assertEquals("the new Conversation entry resolves its recipient again", 2, recipientLookups.get())
        assertEquals("the new Conversation entry loads its messages again", 2, conversationReads.get())
        assertEquals(
            listOf("connect.sid=fictional-session", "connect.sid=renewed-fictional-session"),
            fixture.requests.filter { it.path == "/api/users/mini/member-fox" }.map { it.cookie },
        )
        assertEquals(
            listOf("connect.sid=fictional-session", "connect.sid=renewed-fictional-session"),
            fixture.requests.filter { it.path == "/api/messages/member-fox?limit=100" }.map { it.cookie },
        )
        assertEquals(
            List(3) { "connect.sid=fictional-session" } + List(3) { "connect.sid=renewed-fictional-session" },
            fixture.requests.filter { it.path.startsWith("/api/messages?") }.map { it.cookie },
        )
        assertEquals(
            listOf("connect.sid=fictional-session"),
            fixture.requests.filter { it.method == "POST" && it.path == "/api/messages" }.map { it.cookie },
        )
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString("A fictional reply"),
            ),
        )
    }

    private fun launchMessages(startOnCircles: Boolean = false) {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        if (!startOnCircles) {
            compose.onNodeWithTag("navigation-messages").performClick()
            waitForText("Quiet Fox")
        }
    }

    private fun pressSystemBack() {
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun cancelPredictiveBack() {
        withBackDispatcher { dispatcher ->
            dispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackProgressed(BackEventCompat(30f, 100f, 0.45f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackCancelled()
        }
    }

    private fun completePredictiveBack() {
        withBackDispatcher { dispatcher ->
            dispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackProgressed(BackEventCompat(30f, 100f, 0.9f, BackEventCompat.EDGE_LEFT))
            dispatcher.onBackPressed()
        }
    }

    private fun withBackDispatcher(action: (OnBackPressedDispatcher) -> Unit) {
        var dispatcher: OnBackPressedDispatcher? = null
        requireNotNull(scenario).onActivity { dispatcher = it.onBackPressedDispatcher }
        compose.runOnUiThread { action(requireNotNull(dispatcher)) }
        compose.waitForIdle()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun restorePreferences(preferences: android.content.SharedPreferences, values: Map<String, *>) {
        val editor = preferences.edit().clear()
        values.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }
}
