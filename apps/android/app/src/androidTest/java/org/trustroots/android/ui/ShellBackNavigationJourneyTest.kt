package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
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
class ShellBackNavigationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @Before fun prepareIsolatedShell() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
        startResponder()
    }

    @After fun restoreStateAndStopResponder() {
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test fun backFromContactsReturnsToMenuThenThePreviousDestination() {
        showShell()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("People you connect with on Trustroots will appear here.")

        pressSystemBack()
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        compose.onNodeWithText("Account").assertIsDisplayed()
        pressSystemBack()

        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        assertEquals(session, SecureMobileSessionStore(context).load())
        assertTrue(requests.any { it.startsWith("GET /api/contacts/member-self ") })
    }

    @Test fun backFromAccountReturnsToMenuThenThePreviousDestination() {
        showShell()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        waitForText("Signed in as Steady Heron (@steady-heron).")

        pressSystemBack()
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        pressSystemBack()

        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        assertEquals(session, SecureMobileSessionStore(context).load())
        assertTrue(requests.any { it.startsWith("GET /api/users/steady-heron ") })
    }

    @Test fun backFromMenuMemberProfileReturnsToSearchThenItsMenuOrigin() {
        showShell()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Find people").performScrollTo().performClick()
        waitForText("Find a member")
        compose.onNodeWithText("Name or username").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")

        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Search members").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()

        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        pressSystemBack()
        compose.onNodeWithContentDescription("Search members").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()

        pressSystemBack()
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        compose.onNodeWithText("Find people").assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/users?search=quiet+fox") })
        assertTrue(requests.any { it.startsWith("GET /api/users/quiet-fox ") })
    }

    @Test fun reselectingCurrentTabDoesNotAddAnotherBackEntry() {
        showShell()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")

        pressSystemBack()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        pressSystemBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
    }

    @Test fun queuedSystemBackActionsStopAtTheCirclesRoot() {
        showShell()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-messages").assertIsSelected()

        compose.runOnUiThread {
            compose.activity.onBackPressedDispatcher.onBackPressed()
            compose.activity.onBackPressedDispatcher.onBackPressed()
        }

        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        assertTrue("Repeated Back at the Circles root must not finish the Activity", !compose.activity.isFinishing)
    }

    @Test fun queuedFindPeopleActionsNavigateToSearchOnlyOnce() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        waitForText("Find people")

        val findPeople = clickAction("Find people")
        compose.runOnUiThread {
            findPeople()
            findPeople()
        }
        waitForText("Find a member")

        pressSystemBack()
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        compose.onNodeWithTag("navigation-menu").assertIsSelected()
    }

    @Test fun queuedCirclesReselectDoesNotReplaceANewerMessagesDestination() {
        showShell()
        waitForText("Discover circles")

        val circles = clickActionForTag("navigation-circles")
        val messages = clickActionForTag("navigation-messages")
        compose.runOnUiThread {
            messages()
            circles()
        }

        waitForText("No conversations yet.")
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
    }

    private fun showShell() {
        SecureMobileSessionStore(context).save(session)
        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = "http://127.0.0.1:${server.localPort}",
                    reconcileAlerts = { _, _ -> },
                )
            }
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun clickAction(text: String): () -> Boolean = requireNotNull(
        compose.onNodeWithText(text).fetchSemanticsNode().config[SemanticsActions.OnClick].action,
    )

    private fun clickActionForTag(tag: String): () -> Boolean = requireNotNull(
        compose.onNodeWithTag(tag).fetchSemanticsNode().config[SemanticsActions.OnClick].action,
    )

    private fun pressSystemBack() {
        compose.activity.onBackPressedDispatcher.onBackPressed()
    }

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "shell-back-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket = socket
                try {
                    socket.soTimeout = 2_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        requests += request
                        while (!input.readLine().isNullOrEmpty()) Unit
                        val (status, body) = responseFor(request)
                        val bytes = body.toByteArray()
                        connection.getOutputStream().apply {
                            write("HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun responseFor(request: String): Pair<String, String> = when {
        request.contains("/avatar?") -> "404 Not Found" to ""
        request.startsWith("GET /api/users/steady-heron ") -> "200 OK" to
            """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","email":"heron@example.test","newsletter":false}"""
        request.startsWith("GET /api/users?search=") -> "200 OK" to
            """[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}]"""
        request.startsWith("GET /api/users/quiet-fox ") -> "200 OK" to
            """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A welcoming place to pause."}"""
        request.startsWith("GET /api/messages?") -> "200 OK" to "[]"
        request.startsWith("GET /api/tribes?limit=150 ") -> "200 OK" to "[]"
        request.startsWith("GET /api/users/memberships ") -> "200 OK" to "[]"
        request.startsWith("GET /api/contacts/member-self ") -> "200 OK" to "[]"
        request.startsWith("GET /api/offers-by/") -> "200 OK" to "[]"
        request.startsWith("GET /api/experiences?") -> "200 OK" to "[]"
        else -> "404 Not Found" to "{}"
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
