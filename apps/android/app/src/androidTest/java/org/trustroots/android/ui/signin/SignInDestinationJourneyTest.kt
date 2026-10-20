package org.trustroots.android.ui.signin

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
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
import org.trustroots.android.ui.SignInJourneyActivity

@RunWith(AndroidJUnit4::class)
class SignInDestinationJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private var responder: Thread? = null
    private var releaseSignIn: CountDownLatch? = null
    private var receivedSignIn: CountDownLatch? = null

    @Before fun clearSession() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After fun restoreSessionAndStopServer() {
        runCatching { composeScenario?.close() }
        releaseSignIn?.countDown()
        server.close()
        responder?.join(1_000)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    private var composeScenario: ActivityScenario<SignInJourneyActivity>? = null

    @Test
    fun signInRequestSurvivesActivityRecreationAndDeliversSuccess() {
        receivedSignIn = CountDownLatch(1)
        releaseSignIn = CountDownLatch(1)
        startResponder { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> {
                    requireNotNull(receivedSignIn).countDown()
                    check(requireNotNull(releaseSignIn).await(10, TimeUnit.SECONDS))
                    Response(
                        "200 OK",
                        """{"username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                        "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                    )
                }
                request.line.startsWith("GET /api/users/anonymous-heron ") -> Response(
                    "200 OK",
                    """{"_id":"member-self","username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                )
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                request.line.contains("/avatar?") -> Response("404 Not Found", "")
                else -> Response("404 Not Found", "")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        compose.waitUntil(10_000) { requireNotNull(receivedSignIn).count == 0L }

        scenario.recreate()
        waitForSignIn()
        assertEditableText("signin-username", "anonymous-heron")
        val retainedPassword = arrayOfNulls<String>(1)
        scenario.onActivity { activity ->
            retainedPassword[0] = ViewModelProvider(activity)
                .get(SignInDestinationStoreHolder::class.java)
                .getViewModel(apiBaseUrl, null)
                .state.value.password
        }
        assertEquals("fictional-password", retainedPassword[0])
        compose.onNode(hasProgressBarRangeInfo(androidx.compose.ui.semantics.ProgressBarRangeInfo.Indeterminate))
            .assertIsDisplayed()
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })

        requireNotNull(releaseSignIn).countDown()
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })
        assertEquals("connect.sid=fictional-session", SecureMobileSessionStore(context).load()?.cookieHeader)
        assertEquals("anonymous-heron", SecureMobileSessionStore(context).load()?.member?.username)
    }

    @Test
    fun signingOutCreatesFreshSignInFieldsAndDoesNotReplayOldErrorOrSuccess() {
        var signInCount = 0
        startResponder { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> {
                    signInCount++
                    if (signInCount == 1) {
                        Response(
                            "200 OK",
                            """{"username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                            "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                        )
                    } else {
                        Response("401 Unauthorized", """{"message":"Those credentials were not accepted."}""")
                    }
                }
                request.line.startsWith("GET /api/users/anonymous-heron ") -> Response(
                    "200 OK",
                    """{"_id":"member-self","username":"anonymous-heron","displayName":"Anonymous Heron","email":"anonymous@example.test","newsletter":false}""",
                )
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "POST /api/auth/signout HTTP/1.1" -> Response("200 OK", "{}")
                request.line.contains("/avatar?") -> Response("404 Not Found", "")
                else -> Response("404 Not Found", "")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        waitForText("anonymous@example.test")
        compose.onNodeWithText("Sign out").performScrollTo()
        compose.onNodeWithTag("accountSettingsScreen").performTouchInput {
            swipeUp(startY = height * 0.7f, endY = height * 0.2f)
        }
        val signOutBounds = compose.onNodeWithText("Sign out").fetchSemanticsNode().boundsInRoot
        val navigationBounds = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot
        assertTrue(
            "Sign out must be reachable above the navigation bar",
            signOutBounds.bottom <= navigationBounds.top,
        )
        compose.onNodeWithText("Sign out").assertIsDisplayed().performClick()
        waitForSignIn()

        assertEditableText("signin-username", "")
        assertEditableText("signin-password", "")
        assertTrue(compose.onAllNodesWithText("anonymous-heron").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Those credentials were not accepted.").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Your session expired or is no longer valid. Please sign in again.")
            .fetchSemanticsNodes().isEmpty())
        assertNull(SecureMobileSessionStore(context).load())
        assertTrue(requests.any { it.line.startsWith("POST /api/auth/signout ") })
    }

    @Test
    fun expiredSessionAfterSuccessfulSignInOpensFreshFormWithExpiryMessage() {
        startResponder { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> Response(
                    "200 OK",
                    """{"username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                    "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                )
                request.line.startsWith("GET /api/users/anonymous-heron ") ->
                    Response("401 Unauthorized", """{"message":"Session expired."}""")
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                else -> Response("404 Not Found", "")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("View your profile").performScrollTo().performClick()
        waitForSignIn()

        compose.onNodeWithText("Your session expired or is no longer valid. Please sign in again.")
            .assertIsDisplayed()
        assertEditableText("signin-username", "")
        assertEditableText("signin-password", "")
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })
        assertNull(SecureMobileSessionStore(context).load())
    }

    private fun launchActivity(): ActivityScenario<SignInJourneyActivity> {
        val intent = Intent(context, SignInJourneyActivity::class.java)
            .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, apiBaseUrl)
        return ActivityScenario.launch(intent)
    }

    private val apiBaseUrl: String get() = "http://127.0.0.1:${server.localPort}"

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

    private fun waitForSignIn() {
        try {
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isNotEmpty()
            }
        } catch (error: ComposeTimeoutException) {
            compose.onRoot(useUnmergedTree = true).printToLog("sign-in-form-not-returned")
            val sessionPresent = SecureMobileSessionStore(context).load() != null
            throw AssertionError(
                "Sign-in form did not return. Requests: ${requests.joinToString { it.line }}; " +
                    "savedSessionPresent=$sessionPresent",
                error,
            )
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun assertEditableText(testTag: String, expected: String) {
        val actual = compose.onNodeWithTag(testTag).fetchSemanticsNode()
            .config[SemanticsProperties.EditableText].text
        assertEquals(expected, actual)
    }

    private fun startResponder(responseFor: (CapturedRequest) -> Response) {
        responder = thread(isDaemon = true, name = "sign-in-destination-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                socket.use { connection ->
                    val input = connection.getInputStream().bufferedReader()
                    val line = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine().orEmpty()
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    val body = CharArray(contentLength)
                    var offset = 0
                    while (offset < body.size) {
                        val count = input.read(body, offset, body.size - offset)
                        if (count < 0) break
                        offset += count
                    }
                    val request = CapturedRequest(line, body.concatToString())
                    requests += request
                    val response = responseFor(request)
                    val bytes = response.body.toByteArray()
                    connection.getOutputStream().apply {
                        val headers = (
                            "HTTP/1.1 ${response.status}\r\nContent-Type: application/json\r\n" +
                                response.extraHeaders + "Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                            ).toByteArray()
                        write(headers)
                        write(bytes)
                        flush()
                    }
                }
            }
        }
    }

    private data class CapturedRequest(val line: String, val body: String)

    private data class Response(
        val status: String,
        val body: String,
        val extraHeaders: String = "",
    )
}
