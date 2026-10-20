package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.swipeUp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class TrustrootsAppShellJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0)
    private val session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron"))
    private val messagePreferences by lazy {
        context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE)
    }
    private val sessionPreferences by lazy {
        context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE)
    }
    private lateinit var previousMessagePreferences: Map<String, *>
    private lateinit var previousSessionPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null

    @Before fun resetSavedSessionAndAlertRoute() {
        previousMessagePreferences = messagePreferences.all
        previousSessionPreferences = sessionPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        messagePreferences.edit().clear().commit()
        sessionPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After fun restoreSavedStateAndCloseServer() {
        restorePreferences(messagePreferences, previousMessagePreferences)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
        server.close()
    }

    @Test fun signedInShellNavigatesAcrossCirclesMessagesProfileAndContacts() {
        SecureMobileSessionStore(context).save(session)
        val requests = CopyOnWriteArrayList<String>()
        startResponder(requests) { path ->
            when {
                path.startsWith("/api/users/steady-heron") ->
                    "200 OK" to """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","tagline":"A calm place to land."}"""
                path.startsWith("/api/messages?") -> "200 OK" to "[]"
                path == "/api/tribes?limit=150" -> "200 OK" to "[]"
                path == "/api/users/memberships" -> "200 OK" to "[]"
                path.startsWith("/api/contacts/member-self") -> "200 OK" to "[]"
                path.startsWith("/api/experiences?userTo=member-self") -> "200 OK" to "[]"
                path.startsWith("/api/offers-by/member-self") -> "200 OK" to "[]"
                path.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to ""
            }
        }
        showApp()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("No conversations yet.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Find people").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Find a member").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Find a member").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").performClick()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("View your profile").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A calm place to land.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A calm place to land.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("People you connect with on Trustroots will appear here.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("People you connect with on Trustroots will appear here.").assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/contacts/member-self ") })
    }

    @Test fun menuFindPeopleOpensMemberSearchAndSearchNavigationResetsToMap() {
        SecureMobileSessionStore(context).save(session)
        val requests = CopyOnWriteArrayList<String>()
        startResponder(requests) { path ->
            when {
                path.startsWith("/api/users/steady-heron") ->
                    "200 OK" to """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}"""
                path.startsWith("/api/messages?") -> "200 OK" to "[]"
                path == "/api/tribes?limit=150" -> "200 OK" to "[]"
                path == "/api/users/memberships" -> "200 OK" to "[]"
                path.startsWith("/api/offers?") -> "200 OK" to """{"features":[]}"""
                path.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to ""
            }
        }
        showApp()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Find people").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Name or username").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Name or username").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithTag("placeSearchField").fetchSemanticsNodes().isEmpty())

        compose.onNodeWithTag("navigation-search").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("placeSearchField").fetchSemanticsNodes().isNotEmpty() &&
                requests.any { it.startsWith("GET /api/offers?") }
        }
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Name or username").fetchSemanticsNodes().isEmpty())
    }

    @Test fun accountSignOutClearsTheSessionAndReturnsToSignIn() {
        SecureMobileSessionStore(context).save(session)
        val requests = CopyOnWriteArrayList<String>()
        startResponder(requests) { path ->
            when {
                path.startsWith("/api/users/steady-heron") ->
                    "200 OK" to """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","email":"steady@example.test","newsletter":false}"""
                path.startsWith("/api/messages?") -> "200 OK" to "[]"
                path == "/api/tribes?limit=150" -> "200 OK" to "[]"
                path == "/api/users/memberships" -> "200 OK" to "[]"
                path == "/api/auth/signout" -> "200 OK" to "{}"
                path.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to ""
            }
        }
        showApp()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("steady@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Sign out").performScrollTo()
        compose.onNodeWithTag("accountSettingsScreen").performTouchInput {
            swipeUp(startY = height * 0.7f, endY = height * 0.2f)
        }
        val buttonBounds = compose.onNodeWithText("Sign out").fetchSemanticsNode().boundsInRoot
        val navigationBounds = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot
        assertTrue("Sign out must be reachable above the navigation bar", buttonBounds.bottom <= navigationBounds.top)
        compose.onNodeWithText("Sign out").assertIsEnabled().performClick()

        val signOutRequestObserved = runCatching {
            compose.waitUntil(5_000) { requests.any { it.startsWith("POST /api/auth/signout ") } }
        }.isSuccess
        if (!signOutRequestObserved) {
            compose.onRoot(useUnmergedTree = true).printToLog("signout-no-request")
            assertTrue("Sign-out request was not received. Requests: ${requests.joinToString()}", signOutRequestObserved)
        }
        val returnedToSignIn = runCatching {
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isNotEmpty()
            }
        }.isSuccess
        if (!returnedToSignIn) {
            compose.onRoot(useUnmergedTree = true).printToLog("signout-no-return")
            assertTrue("Sign-out request completed but app did not return to sign in. Requests: ${requests.joinToString()}", returnedToSignIn)
        }
        assertTrue(returnedToSignIn)
        assertNull(SecureMobileSessionStore(context).load())
        assertTrue(requests.any { it.startsWith("POST /api/auth/signout ") })
    }

    @Test fun invalidOwnProfileSessionReturnsToSignInWithAnExplanation() {
        SecureMobileSessionStore(context).save(session)
        val requests = CopyOnWriteArrayList<String>()
        startResponder(requests) { path ->
            when {
                path.startsWith("/api/users/steady-heron") -> "401 Unauthorized" to """{"message":"Session expired."}"""
                path.startsWith("/api/messages?") -> "200 OK" to "[]"
                path == "/api/tribes?limit=150" -> "200 OK" to "[]"
                path == "/api/users/memberships" -> "200 OK" to "[]"
                path.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to ""
            }
        }
        showApp()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Your session expired or is no longer valid. Please sign in again.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Username or email").assertIsDisplayed()
        compose.onNodeWithText("Your session expired or is no longer valid. Please sign in again.")
            .assertIsDisplayed()
        assertNull(SecureMobileSessionStore(context).load())
        assertTrue(requests.count { it.startsWith("GET /api/users/steady-heron ") } == 1)
    }

    private fun showApp() {
        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = "http://127.0.0.1:${server.localPort}",
                    reconcileAlerts = { _, _ -> },
                )
            }
        }
    }

    private fun startResponder(
        requests: MutableList<String>,
        payload: (String) -> Pair<String, String>,
    ) {
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    val path = request.substringAfter(' ').substringBefore(' ')
                    requests += request
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val (status, body) = if (path.contains("/avatar?")) {
                        "404 Not Found" to ""
                    } else {
                        payload(path)
                    }
                    val bytes = body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
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
