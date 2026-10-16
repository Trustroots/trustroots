package org.trustroots.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.io.IOException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.analytics.AndroidUsageAnalytics
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ShellBrowserRoutesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val apiBaseUrl by lazy { "http://127.0.0.1:${server.localPort}" }
    private val session = MemberSession(
        "connect.sid=fictional-browser-route-session",
        MobileMember("browser-route-member", "Browser Route Member"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private val analyticsPreferences by lazy { context.getSharedPreferences("usage-analytics", Context.MODE_PRIVATE) }
    private val analytics by lazy { AndroidUsageAnalytics.get(context) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private lateinit var previousAnalyticsPreferences: Map<String, *>
    private var previousAnalyticsEnabled = false
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @Before fun isolateAppState() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousAnalyticsPreferences = analyticsPreferences.all
        previousAnalyticsEnabled = analytics.enabled.value
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
        analytics.setEnabled(false)
        SecureResponseCache(context).clear(apiBaseUrl, session.member.username)
    }

    @After fun restoreStateAndStopFixture() {
        try {
            compose.activityRule.scenario.close()
        } finally {
            runCatching { activeSocket?.close() }
            runCatching { server.close() }
            runCatching { responder?.join(1_000) }
            restorePreferences(sessionPreferences, previousSessionPreferences)
            restorePreferences(alertPreferences, previousAlertPreferences)
            restorePreferences(analyticsPreferences, previousAnalyticsPreferences)
            MessageAlerts.destination.value = previousDestination
            MessageAlerts.status.value = previousStatus
            analytics.setEnabled(previousAnalyticsEnabled)
            SecureResponseCache(context).clear(apiBaseUrl, session.member.username)
        }
    }

    @Test fun signInJoinAndPasswordResetUseOfflineBrowserSurface() {
        startResponder()
        showApp()

        waitForText("Username or email")
        compose.onNodeWithText("Join").performScrollTo().performClick()
        assertBrowserRoute("Join Trustroots", "https://www.trustroots.org/signup")
        compose.onNodeWithText("Close fake browser").performClick()
        compose.onNodeWithText("Username or email").assertIsDisplayed()

        compose.onNodeWithText("Forgot password?").performScrollTo().performClick()
        assertBrowserRoute("Reset password", "https://www.trustroots.org/password/forgot")
        compose.onNodeWithText("Close fake browser").performClick()
        compose.onNodeWithText("Username or email").assertIsDisplayed()
        assertTrue(requests.isEmpty())
    }

    @Test fun menuSupportAndAccountResetUseOfflineBrowserSurface() {
        SecureMobileSessionStore(context).save(session)
        startResponder()
        showApp()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        scrollMenuControlAboveNavigation("Contact and support")
        compose.onNodeWithText("Contact and support").performClick()
        assertBrowserRoute("Contact and support", "https://www.trustroots.org/support")
        compose.onNodeWithText("Close fake browser").performClick()

        scrollMenuControlAboveNavigation("Account")
        compose.onNodeWithText("Account").performClick()
        waitForText("Email address")
        scrollAccountControlAboveNavigation("Forgot your password?")
        compose.onNodeWithText("Forgot your password?").performClick()
        assertBrowserRoute("Reset password", "https://www.trustroots.org/password/forgot")
        compose.onNodeWithText("Close fake browser").performClick()
        compose.onNodeWithText("Account").assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/users/browser-route-member ") })
        assertTrue(requests.none { it.startsWith("GET /signup ") || it.startsWith("GET /password/forgot ") })
    }

    @Test fun systemBackClosesBrowserAndPreservesItsMenuOrAccountOrigin() {
        SecureMobileSessionStore(context).save(session)
        startResponder()
        showApp()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        scrollMenuControlAboveNavigation("Contact and support")
        compose.onNodeWithText("Contact and support").performClick()
        assertBrowserRoute("Contact and support", "https://www.trustroots.org/support")

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithTag("offlineBrowserSurface").assertDoesNotExist()
        scrollMenuControlAboveNavigation("Account")
        compose.onNodeWithText("Account").performClick()
        waitForText("Email address")
        scrollAccountControlAboveNavigation("Forgot your password?")
        compose.onNodeWithText("Forgot your password?").performClick()
        assertBrowserRoute("Reset password", "https://www.trustroots.org/password/forgot")

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithTag("offlineBrowserSurface").assertDoesNotExist()
        compose.onNodeWithTag("accountSettingsScreen").assertIsDisplayed()
        compose.onNodeWithText("Email address").assertExists()
        assertTrue(requests.none { it.startsWith("GET /support ") || it.startsWith("GET /password/forgot ") })
    }

    private fun showApp() {
        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = apiBaseUrl,
                    reconcileAlerts = { _, _ -> },
                    browserContent = { route, onClose, contentPadding ->
                        OfflineBrowserSurface(route, onClose, contentPadding)
                    },
                )
            }
        }
    }

    private fun assertBrowserRoute(title: String, url: String) {
        compose.onNodeWithTag("offlineBrowserSurface").assertIsDisplayed()
        compose.onNodeWithText("Fake browser: $title").assertIsDisplayed()
        compose.onNodeWithText(url).assertIsDisplayed()
    }

    private fun scrollMenuControlAboveNavigation(text: String) {
        val control = compose.onNodeWithText(text).performScrollTo()
        val navigationTop = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot.top
        var bounds = control.fetchSemanticsNode().boundsInRoot
        var swipes = 0
        while (bounds.bottom > navigationTop && swipes < 5) {
            compose.onRoot().performTouchInput {
                swipeUp(startY = height * 0.7f, endY = height * 0.2f)
            }
            bounds = control.fetchSemanticsNode().boundsInRoot
            swipes++
        }
        control.assertIsDisplayed()
        assertTrue("$text must be above the bottom navigation before clicking", bounds.bottom <= navigationTop)
    }

    private fun scrollAccountControlAboveNavigation(text: String) {
        val control = compose.onNodeWithText(text).performScrollTo()
        val navigationTop = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot.top
        var bounds = control.fetchSemanticsNode().boundsInRoot
        var swipes = 0
        while (bounds.bottom > navigationTop && swipes < 5) {
            compose.onNodeWithTag("accountSettingsScreen").performTouchInput {
                swipeUp(startY = height * 0.7f, endY = height * 0.2f)
            }
            bounds = control.fetchSemanticsNode().boundsInRoot
            swipes++
        }
        control.assertIsDisplayed()
        assertTrue("$text must be above the bottom navigation before clicking", bounds.bottom <= navigationTop)
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "shell-browser-route-local-api") {
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
                        val path = request.substringAfter(' ').substringBefore(' ')
                        val (status, body) = when {
                            path.startsWith("/api/users/browser-route-member") -> "200 OK" to
                                """{"_id":"browser-route-profile","username":"browser-route-member","displayName":"Browser Route Member","email":"fictional@example.test","newsletter":false}"""
                            path.startsWith("/api/messages?") -> "200 OK" to "[]"
                            path == "/api/tribes?limit=150" -> "200 OK" to "[]"
                            path == "/api/users/memberships" -> "200 OK" to "[]"
                            path.contains("/avatar?") -> "404 Not Found" to ""
                            else -> "404 Not Found" to "{}"
                        }
                        val bytes = body.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 $status\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw IOException("Local browser-route fixture could not complete a request", error)
                } finally {
                    activeSocket = null
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

@Composable
private fun OfflineBrowserSurface(
    route: BrowserRoute,
    onClose: () -> Unit,
    contentPadding: PaddingValues,
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(contentPadding)
            .padding(20.dp)
            .testTag("offlineBrowserSurface"),
    ) {
        Text("Fake browser: ${route.title}")
        Text(route.url)
        TextButton(onClick = onClose) { Text("Close fake browser") }
    }
}
