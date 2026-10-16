package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class SignInSessionJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0)
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
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val signInAttempts = AtomicInteger()

    @Before fun clearStoredAccountAndAlerts() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After fun restoreSavedStateAndCloseServer() {
        server.close()
        responder?.join(1_000)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test fun rejectedCredentialsCanBeCorrectedAndCreateAnEncryptedSession() {
        startResponder()
        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = "http://127.0.0.1:${server.localPort}",
                    reconcileAlerts = { _, _ -> },
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Username or email").performTextInput("  steady-heron  ")
        compose.onNodeWithText("Password").performTextInput("wrong-fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Those credentials were not accepted.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Those credentials were not accepted.").assertIsDisplayed()
        assertNull(SecureMobileSessionStore(context).load())

        compose.onNodeWithText("Password").performTextReplacement("correct-fictional-password")
        compose.waitUntil(5_000) {
            runCatching { compose.onNodeWithText("Sign in").assertIsEnabled() }.isSuccess
        }
        compose.onNodeWithText("Sign in").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("No conversations yet.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()

        val signInRequests = requests.filter { it.requestLine.startsWith("POST /api/auth/signin ") }
        assertEquals(2, signInRequests.size)
        assertEquals("steady-heron", JSONObject(signInRequests[0].body).getString("username"))
        assertEquals("wrong-fictional-password", JSONObject(signInRequests[0].body).getString("password"))
        assertEquals("correct-fictional-password", JSONObject(signInRequests[1].body).getString("password"))
        assertEquals(
            "connect.sid=fictional-session",
            SecureMobileSessionStore(context).load()?.cookieHeader,
        )
        assertEquals("steady-heron", SecureMobileSessionStore(context).load()?.member?.username)
    }

    private fun startResponder() {
        responder = thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
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
                    val body = bodyBuffer.concatToString()
                    requests += CapturedRequest(requestLine, body)
                    val response = when {
                        requestLine.startsWith("POST /api/auth/signin ") -> {
                            if (signInAttempts.incrementAndGet() == 1) {
                                FixtureResponse("401 Unauthorized", """{"message":"Those credentials were not accepted."}""")
                            } else {
                                FixtureResponse(
                                    "200 OK",
                                    """{"username":"steady-heron","displayName":"Steady Heron"}""",
                                    "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                                )
                            }
                        }
                        requestLine.startsWith("GET /api/users/steady-heron ") -> FixtureResponse(
                            "200 OK",
                            """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
                        )
                        requestLine.startsWith("GET /api/messages?") -> FixtureResponse("200 OK", "[]")
                        requestLine == "GET /api/tribes?limit=150 HTTP/1.1" -> FixtureResponse("200 OK", "[]")
                        requestLine == "GET /api/users/memberships HTTP/1.1" -> FixtureResponse("200 OK", "[]")
                        requestLine.contains("/avatar?") -> FixtureResponse("404 Not Found", "")
                        else -> FixtureResponse("404 Not Found", "")
                    }
                    val bytes = response.body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 ${response.status}\r\nContent-Type: application/json\r\n${response.extraHeaders}Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
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

    private data class CapturedRequest(val requestLine: String, val body: String)
    private data class FixtureResponse(
        val status: String,
        val body: String,
        val extraHeaders: String = "",
    )
}
