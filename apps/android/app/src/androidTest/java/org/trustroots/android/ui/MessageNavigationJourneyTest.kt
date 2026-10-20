package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedDispatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
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
import org.junit.After
import org.junit.Assert.assertEquals
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
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousAlertStatus: String? = null
    private var previousAlertDestination: MessageDestination? = null
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private val inboxRequests = AtomicInteger()
    private val fixture = LocalTransportFixture { request ->
        when {
            request.path == "/api/users/steady-heron" -> LocalTransportFixture.Response(
                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
            )
            request.path == "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}""",
            )
            request.path.startsWith("/api/messages?") -> {
                inboxRequests.incrementAndGet()
                LocalTransportFixture.Response(
                    """[
                        {"_id":"thread-fox","userFrom":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"userTo":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"},"message":{"excerpt":"Fictional trail note"},"read":true}
                    ]""",
                )
            }
            request.path == "/api/messages/member-fox?limit=100" -> LocalTransportFixture.Response(
                """[{"_id":"message-fox","content":"Fictional route message","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
            )
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
        previousAlertStatus = MessageAlerts.status.value
        previousAlertDestination = MessageAlerts.destination.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        inboxRequests.set(0)
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
        )
    }

    @After fun closeScenarioAndRestoreShellState() {
        scenario?.close()
        fixture.close()
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousAlertDestination
        MessageAlerts.status.value = previousAlertStatus
    }

    @Test fun conversationAndProfileBackRestoreInboxFilterAndReturnRefreshes() {
        launchMessages()
        waitForText("Quiet Fox")
        compose.waitUntil(10_000) { inboxRequests.get() >= 2 }
        val initialInboxRequests = inboxRequests.get()
        compose.onNodeWithText("Filter conversations").performTextReplacement("quiet-fox")
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        compose.onNodeWithText("View profile").performClick()
        waitForText("About")
        pressSystemBack()
        compose.onNodeWithText("Fictional route message").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        compose.onNodeWithText("Filter conversations").assertIsDisplayed()
        assertEquals("Returning from the conversation refreshes the inbox once", initialInboxRequests + 1, inboxRequests.get())
    }

    @Test fun conversationRouteRestoresAfterActivityRecreationAndMessagesReselectionResetsIt() {
        launchMessages()
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        val beforeRecreation = inboxRequests.get()
        requireNotNull(scenario).recreate()
        waitForText("Fictional route message")
        compose.waitUntil(10_000) { inboxRequests.get() >= beforeRecreation + 2 }
        pressSystemBack()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        compose.onNodeWithTag("message-thread-thread-fox").performClick()
        waitForText("Fictional route message")
        val beforeReselection = inboxRequests.get()
        compose.onNodeWithTag("navigation-messages").performClick()
        compose.onNodeWithTag("message-thread-thread-fox").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        compose.waitUntil(10_000) { inboxRequests.get() >= beforeReselection + 2 }
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
