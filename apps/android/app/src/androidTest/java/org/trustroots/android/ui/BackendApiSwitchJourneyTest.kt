package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(androidx.test.ext.junit.runners.AndroidJUnit4::class)
class BackendApiSwitchJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val session = MemberSession(
        "connect.sid=fictional-backend-switch-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val sessionPreferences by lazy {
        context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE)
    }
    private val alertPreferences by lazy {
        context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE)
    }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null

    @Before fun isolateSessionAndAlerts() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After fun restoreSessionAndAlerts() {
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test fun signedInShellUsesChangedBackendForScreensAndSignOut() {
        val responseCache = SecureResponseCache(context)
        val firstBackend = LocalTransportFixture { request ->
            respondToBackendRequest(request, "First backend circle", "first-backend@example.test")
        }
        val secondBackend = LocalTransportFixture { request ->
            respondToBackendRequest(request, "Second backend circle", "second-backend@example.test")
        }
        try {
            responseCache.clear(firstBackend.baseURL, session.member.username)
            responseCache.clear(secondBackend.baseURL, session.member.username)
            SecureMobileSessionStore(context).save(session)

            val currentBackend = mutableStateOf(firstBackend.baseURL)
            compose.setContent {
                TrustrootsTheme {
                    TrustrootsApp(
                        apiBaseUrl = currentBackend.value,
                        reconcileAlerts = { _, _ -> },
                    )
                }
            }

            waitForText("First backend circle")
            assertTrue(firstBackend.requests.any { it.path == "/api/tribes?limit=150" })

            compose.runOnIdle { currentBackend.value = secondBackend.baseURL }

            compose.waitUntil(10_000) {
                secondBackend.requests.any {
                    it.method == "GET" && it.path == "/api/users/steady-heron"
                }
            }

            compose.onNodeWithTag("navigation-menu").performClick()
            compose.onNodeWithText("Account").performScrollTo().performClick()
            waitForText("second-backend@example.test")
            compose.onNodeWithTag("accountSettingsScreen").performTouchInput {
                swipeUp(startY = height * 0.7f, endY = height * 0.2f)
            }
            compose.onNodeWithText("Sign out").performScrollTo().assertIsEnabled().performClick()

            waitForText("Username or email")
            assertTrue(
                "Sign-out must use the current backend",
                secondBackend.requests.any { it.method == "POST" && it.path == "/api/auth/signout" },
            )
            assertTrue(
                "The previous backend must not receive the sign-out request",
                firstBackend.requests.none { it.method == "POST" && it.path == "/api/auth/signout" },
            )
            assertNull(SecureMobileSessionStore(context).load())
        } finally {
            responseCache.clear(firstBackend.baseURL, session.member.username)
            responseCache.clear(secondBackend.baseURL, session.member.username)
            firstBackend.close()
            secondBackend.close()
        }
    }

    private fun respondToBackendRequest(
        request: LocalTransportFixture.Request,
        circleLabel: String,
        email: String,
    ): LocalTransportFixture.Response = when {
        request.method == "GET" && request.path == "/api/tribes?limit=150" ->
            LocalTransportFixture.Response(
                """[{"_id":"fictional-circle","slug":"fictional-circle","label":"$circleLabel","count":1,"image":false}]""",
            )
        request.method == "GET" && request.path == "/api/users/memberships" ->
            LocalTransportFixture.Response("[]")
        request.method == "GET" && request.path == "/api/users/steady-heron" ->
            LocalTransportFixture.Response(
                """{"_id":"fictional-member-id","username":"steady-heron","displayName":"Steady Heron","email":"$email","newsletter":false,"tagline":"A calm place to land.","description":"Hello travellers.","languages":["eng"]}""",
            )
        request.path.startsWith("/api/messages") -> LocalTransportFixture.Response("[]")
        request.method == "POST" && request.path == "/api/auth/signout" ->
            LocalTransportFixture.Response("{}")
        else -> LocalTransportFixture.Response("{}", status = 404)
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText(text).assertIsDisplayed()
    }

    private fun restorePreferences(preferences: SharedPreferences, values: Map<String, *>) {
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
