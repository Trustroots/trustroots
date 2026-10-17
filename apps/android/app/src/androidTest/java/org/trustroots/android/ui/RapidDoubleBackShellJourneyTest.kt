package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class RapidDoubleBackShellJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private var fixture: LocalTransportFixture? = null
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null

    @Before fun prepareIsolatedShell() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
        fixture = LocalTransportFixture { request ->
            when {
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
                    )
                request.method == "GET" && request.path.startsWith("/api/messages?") ->
                    LocalTransportFixture.Response("[]")
                request.path == "/api/tribes?limit=150" -> LocalTransportFixture.Response("[]")
                request.path == "/api/users/memberships" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contacts/member-self" -> LocalTransportFixture.Response("[]")
                request.path.startsWith("/api/offers-by/") -> LocalTransportFixture.Response("[]")
                request.path.startsWith("/api/experiences?") -> LocalTransportFixture.Response("[]")
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }
    }

    @After fun restoreStateAndCloseFixture() {
        try {
            fixture?.close()
        } finally {
            restorePreferences(sessionPreferences, previousSessionPreferences)
            restorePreferences(alertPreferences, previousAlertPreferences)
            MessageAlerts.destination.value = previousDestination
            MessageAlerts.status.value = previousStatus
        }
    }

    @Test fun rapidDoubleSystemBackAfterFinalPopLeavesSignedInShellUsable() {
        SecureMobileSessionStore(context).save(session)
        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = requireNotNull(fixture).baseURL,
                    reconcileAlerts = { _, _ -> },
                )
            }
        }
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")

        compose.runOnUiThread {
            compose.activity.onBackPressedDispatcher.onBackPressed()
            compose.activity.onBackPressedDispatcher.onBackPressed()
        }
        compose.waitForIdle()

        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        assertEquals("A rapid second Back must not sign out the member", session, SecureMobileSessionStore(context).load())
        assertFalse(compose.activity.isFinishing)

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        assertTrue(
            requireNotNull(fixture).requests.any {
                it.method == "GET" && it.path == "/api/messages?page=1&limit=50"
            },
        )
        assertEquals(session, SecureMobileSessionStore(context).load())
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun restorePreferences(preferences: SharedPreferences, values: Map<String, *>) {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
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
