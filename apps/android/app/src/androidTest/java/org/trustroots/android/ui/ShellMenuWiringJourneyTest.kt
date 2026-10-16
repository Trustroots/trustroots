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
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.nio.charset.StandardCharsets
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
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
class ShellMenuWiringJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val apiBaseUrl by lazy { "http://127.0.0.1:${server.localPort}" }
    private val session = MemberSession(
        "connect.sid=fictional-shell-menu-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
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
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null
    private val responderFailure = AtomicReference<Throwable?>(null)

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
        startResponder()
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

    @Test fun menuNostrootsRouteUsesTheOfflineBrowserWithTheSignedInCookie() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        scrollMenuControlAboveNavigation("Nostroots")
        compose.onNodeWithText("Nostroots").performClick()

        compose.onNodeWithTag("offlineBrowserSurface").assertIsDisplayed()
        compose.onNodeWithText("Fake browser: Nostroots").assertIsDisplayed()
        compose.onNodeWithText("https://nos.trustroots.org/").assertIsDisplayed()
        compose.onNodeWithText("Fake browser cookie: connect.sid=fictional-shell-menu-session").assertIsDisplayed()
        assertTrue(requests.none { it.path.startsWith("/signup") || it.path.startsWith("/contact-add") })

        compose.onNodeWithText("Close fake browser").performClick()
        compose.onNodeWithTag("offlineBrowserSurface").assertDoesNotExist()
        compose.onNodeWithText("Nostroots").assertIsDisplayed()
        assertNoResponderFailure()
    }

    @Test fun menuHostRouteLoadsTheOwnOfferAndReturnsToMenu() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        scrollMenuControlAboveNavigation("Host")
        compose.onNodeWithText("Host").performClick()

        waitForText("Hosting description")
        compose.onNodeWithTag("hostOfferScreen").assertIsDisplayed()
        assertTrue(requests.any { it.path == "/api/users/steady-heron" })
        assertTrue(requests.any { it.path == "/api/offers-by/member-self?types=host" })

        compose.onNodeWithContentDescription("Cancel").performClick()
        waitForText("View your profile")
        compose.onNodeWithText("Host").assertIsDisplayed()
        assertNoResponderFailure()
    }

    @Test fun directEditProfileMenuSaveUpdatesTheShellSession() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        scrollMenuControlAboveNavigation("Edit profile")
        compose.onNodeWithText("Edit profile").performClick()

        waitForText("Name")
        compose.onNodeWithText("Name").performTextReplacement("Updated Heron")
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            SecureMobileSessionStore(context).load()?.member?.displayName == "Updated Heron"
        }
        compose.waitForIdle()
        assertEquals(1, requests.count { it.method == "PUT" && it.path == "/api/users" })
        val update = requests.single { it.method == "PUT" && it.path == "/api/users" }
        assertEquals("Updated Heron", JSONObject(update.body).getString("displayName"))

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Updated Heron").assertIsDisplayed()
        assertTrue(requests.any { it.method == "GET" && it.path == "/api/users/steady-heron" })
        assertNoResponderFailure()
    }

    private fun showShell() {
        SecureMobileSessionStore(context).save(session)
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

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "shell-menu-local-api") {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        continue
                    } catch (error: SocketException) {
                        if (server.isClosed) break else throw error
                    }
                    activeSocket = socket
                    socket.soTimeout = 3_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader(StandardCharsets.US_ASCII)
                        val requestLine = input.readLine().orEmpty()
                        val parts = requestLine.split(' ')
                        val method = parts.getOrElse(0) { "" }
                        val path = parts.getOrElse(1) { "" }
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine() ?: throw IOException("EOF before request headers completed")
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val bodyBuffer = CharArray(contentLength)
                        var offset = 0
                        while (offset < bodyBuffer.size) {
                            val count = input.read(bodyBuffer, offset, bodyBuffer.size - offset)
                            if (count < 0) throw IOException("EOF before request body completed")
                            offset += count
                        }
                        val body = bodyBuffer.concatToString(0, offset)
                        requests += CapturedRequest(method, path, body)
                        val responseBody = responseFor(method, path, body)
                        val bytes = responseBody.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                    }
                    activeSocket = null
                }
            } catch (error: Throwable) {
                if (!server.isClosed) responderFailure.set(error)
            } finally {
                activeSocket = null
            }
        }
    }

    private fun responseFor(method: String, path: String, body: String): String = when {
        method == "PUT" && path == "/api/users" -> {
            val update = JSONObject(body)
            JSONObject()
                .put("_id", "member-self")
                .put("username", session.member.username)
                .put("displayName", update.getString("displayName"))
                .put("tagline", update.getString("tagline"))
                .put("description", update.getString("description"))
                .put("locationLiving", update.getString("locationLiving"))
                .put("locationFrom", update.getString("locationFrom"))
                .put("languages", update.getJSONArray("languages"))
                .toString()
        }
        path.startsWith("/api/users/") && path.contains("/avatar?") -> "{}"
        method == "GET" && path == "/api/users/${session.member.username}" -> profileBody()
        method == "GET" && path == "/api/messages?page=1&limit=50" -> "[]"
        method == "GET" && path == "/api/tribes?limit=150" -> "[]"
        method == "GET" && path == "/api/users/memberships" -> "[]"
        method == "GET" && path.startsWith("/api/offers-by/") -> "[]"
        method == "GET" && path.startsWith("/api/contacts/") -> "[]"
        method == "GET" && path.startsWith("/api/experiences?") -> "[]"
        else -> "{}"
    }

    private fun profileBody(): String = JSONObject()
        .put("_id", "member-self")
        .put("username", session.member.username)
        .put("displayName", session.member.displayName)
        .put("tagline", "A calm place to land.")
        .put("description", "I enjoy quiet journeys.")
        .put("locationLiving", "Fictional Bay")
        .put("locationFrom", "Imaginary Coast")
        .put("languages", org.json.JSONArray(listOf("eng")))
        .toString()

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
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

    private fun assertNoResponderFailure() {
        responderFailure.get()?.let { throw AssertionError("Local shell fixture failed", it) }
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
        Text("Fake browser cookie: ${route.sessionCookie.orEmpty()}")
        TextButton(onClick = onClose) { Text("Close fake browser") }
    }
}
