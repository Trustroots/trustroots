package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject
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
class TrustrootsMemberShellJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0)
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
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
    private var responder: Thread? = null

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
        server.close()
        responder?.join(1_000)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test fun contactsOpenAMemberProfileAndBackReturnsToTheContactList() {
        showShell()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")

        compose.onNodeWithText("A welcoming place to pause.").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A welcoming place to pause.").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertDoesNotExist()

        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A welcoming place to pause.").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(requests.any { it.path == "/api/contacts/member-self" })
        assertTrue(requests.any { it.path == "/api/users/quiet-fox" })
    }

    @Test fun savingOwnProfileUpdatesThePersistedShellMember() {
        SecureMobileSessionStore(context).save(session)
        showShell()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("View your profile").performScrollTo().performClick()
        waitForText("A calm place to land.")
        compose.onNodeWithText("Edit your profile").performClick()
        compose.onNodeWithText("Name").performTextReplacement("Updated Heron")
        compose.onNodeWithText("Tagline").performTextReplacement("A brighter place to land.")
        compose.onNodeWithText("Save changes").performClick()

        waitForText("A brighter place to land.")
        compose.onNodeWithText("A brighter place to land.").assertIsDisplayed()
        compose.waitUntil(5_000) {
            SecureMobileSessionStore(context).load()?.member?.displayName == "Updated Heron"
        }
        val update = requests.lastOrNull { it.method == "PUT" && it.path == "/api/users" }
            ?: error("Expected the profile update request")
        assertEquals("Updated Heron", JSONObject(update.body).getString("displayName"))
        assertEquals("A brighter place to land.", JSONObject(update.body).getString("tagline"))
        assertEquals("Updated Heron", SecureMobileSessionStore(context).load()?.member?.displayName)
    }

    @Test fun shellNavigationWaitsForAnExplicitDecisionOnUnsavedProfileChanges() {
        SecureMobileSessionStore(context).save(session)
        showShell()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        waitForText("Save changes")
        compose.onNodeWithText("Tagline").performTextReplacement("An unsaved change")

        compose.onNodeWithTag("navigation-messages").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("An unsaved change").assertIsDisplayed()

        compose.onNodeWithTag("navigation-messages").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Discard changes").performClick()
        waitForText("No conversations yet.")

        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        assertTrue(requests.none { it.method == "PUT" && it.path == "/api/users" })
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

    private fun startResponder() {
        responder = thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                try {
                    socket.use {
                        val input = socket.getInputStream().bufferedReader()
                        val requestLine = input.readLine().orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine().orEmpty()
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val bodyBuffer = CharArray(contentLength)
                        var bodyOffset = 0
                        while (bodyOffset < bodyBuffer.size) {
                            val count = input.read(bodyBuffer, bodyOffset, bodyBuffer.size - bodyOffset)
                            if (count < 0) break
                            bodyOffset += count
                        }
                        val body = bodyBuffer.concatToString(0, bodyOffset)
                        val method = requestLine.substringBefore(' ')
                        val path = requestLine.substringAfter(' ').substringBefore(' ')
                        requests += CapturedRequest(method, path, body)
                        val response = responseFor(method, path, body)
                        val bytes = response.body.toByteArray()
                        socket.getOutputStream().write(
                            "HTTP/1.1 ${response.status}\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        socket.getOutputStream().write(bytes)
                        socket.getOutputStream().flush()
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw error
                }
            }
        }
    }

    private fun responseFor(method: String, path: String, body: String): FixtureResponse = when {
        path.contains("/avatar?") -> FixtureResponse("404 Not Found", "")
        method == "PUT" && path == "/api/users" -> {
            val update = JSONObject(body)
            FixtureResponse(
                "200 OK",
                update
                    .put("_id", "member-self")
                    .put("username", "steady-heron")
                    .put("email", "heron@example.test")
                    .put("newsletter", false)
                    .toString(),
            )
        }
        path == "/api/users/steady-heron" -> FixtureResponse(
            "200 OK",
            """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","email":"heron@example.test","newsletter":false,"tagline":"A calm place to land.","description":"Hello travellers","languages":["eng"]}""",
        )
        path == "/api/users/quiet-fox" -> FixtureResponse(
            "200 OK",
            """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A welcoming place to pause.","description":"A neighbour who enjoys slow journeys.","languages":["por"]}""",
        )
        path.startsWith("/api/messages?") -> FixtureResponse("200 OK", "[]")
        path == "/api/tribes?limit=150" -> FixtureResponse("200 OK", "[]")
        path == "/api/users/memberships" -> FixtureResponse("200 OK", "[]")
        path == "/api/contacts/member-self" -> FixtureResponse("200 OK", CONTACTS)
        path.startsWith("/api/contacts/") -> FixtureResponse("200 OK", "[]")
        path.startsWith("/api/offers-by/") -> FixtureResponse("200 OK", "[]")
        path.startsWith("/api/experiences?") -> FixtureResponse("200 OK", "[]")
        path.startsWith("/api/contact-by/") -> FixtureResponse("404 Not Found", "")
        else -> FixtureResponse("404 Not Found", "")
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

    private data class CapturedRequest(val method: String, val path: String, val body: String)
    private data class FixtureResponse(val status: String, val body: String)

    private companion object {
        val CONTACTS = JSONArray()
            .put(
                JSONObject()
                    .put("_id", "contact-one")
                    .put(
                        "user",
                        JSONObject()
                            .put("_id", "member-one")
                            .put("username", "quiet-fox")
                            .put("displayName", "Quiet Fox"),
                    ),
            )
            .toString()
    }
}
