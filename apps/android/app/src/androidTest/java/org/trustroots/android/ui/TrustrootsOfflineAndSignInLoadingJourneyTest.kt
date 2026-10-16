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
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
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
class TrustrootsOfflineAndSignInLoadingJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
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
    private var fixture: ServerSocket? = null
    private var apiBaseUrl: String? = null
    private var cacheAccount: String? = null
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null
    private var releaseSignInResponse: CountDownLatch? = null
    private var signInRequestReceived: CountDownLatch? = null
    private val requests = CopyOnWriteArrayList<String>()
    private val responderFailure = AtomicReference<Throwable?>(null)

    @Test fun cachedProfileFallbackShowsOfflineSavedAtInTheSignedInShell() {
        val member = MobileMember("offline-cache-${UUID.randomUUID()}", "Offline Cache Heron")
        cacheAccount = member.username
        val session = MemberSession("connect.sid=fictional-offline-session", member)
        val server = ServerSocket(0)
        fixture = server
        apiBaseUrl = "http://127.0.0.1:${server.localPort}"
        server.close()

        val responseCache = SecureResponseCache(context)
        responseCache.clear(requireNotNull(apiBaseUrl), member.username)
        val profilePath = "/api/users/${member.username}"
        responseCache.save(
            requireNotNull(apiBaseUrl),
            member.username,
            profilePath,
            """{"_id":"fictional-offline-profile","username":"${member.username}","displayName":"Offline Cache Heron"}""",
        )
        val savedAt = responseCache.load(requireNotNull(apiBaseUrl), member.username, profilePath)?.savedAt
        assertNotNull("The encrypted fixture snapshot should be readable", savedAt)
        SecureMobileSessionStore(context).save(session)

        showApp()

        val expectedBanner = "Offline · Showing saved data from " +
            SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(requireNotNull(savedAt)))
        waitForText(expectedBanner)
        compose.onNodeWithText(expectedBanner).assertIsDisplayed()
    }

    @Test fun signInKeepsProgressVisibleUntilTheLocalApiResponds() {
        val server = ServerSocket(0).apply { soTimeout = 500 }
        fixture = server
        apiBaseUrl = "http://127.0.0.1:${server.localPort}"
        signInRequestReceived = CountDownLatch(1)
        releaseSignInResponse = CountDownLatch(1)
        startBlockedSignInResponder(server)
        showApp()

        waitForText("Username or email")
        compose.onNodeWithText("Username or email").performTextInput("steady-heron")
        compose.onNodeWithText("Password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()

        assertTrue(
            "The local fixture should receive the sign-in request before the response is released",
            requireNotNull(signInRequestReceived).await(10, TimeUnit.SECONDS),
        )
        compose.waitUntil(10_000) {
            compose.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate))
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Sign in").fetchSemanticsNodes().isEmpty())
        assertEquals(1, requests.count { it.startsWith("POST /api/auth/signin ") })
        assertEquals("POST /api/auth/signin HTTP/1.1", requests.single())

        requireNotNull(releaseSignInResponse).countDown()
        waitForText("Fictional credentials were rejected.")
        compose.waitForIdle()
        compose.onNodeWithText("Sign in").assertIsDisplayed()
        responderFailure.get()?.let { throw AssertionError("Local sign-in responder failed", it) }
    }

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
    }

    @After fun restoreStateAndStopFixture() {
        try {
            compose.activityRule.scenario.close()
        } finally {
            releaseSignInResponse?.countDown()
            runCatching { activeSocket?.close() }
            runCatching { fixture?.close() }
            runCatching { responder?.join(1_000) }
            if (apiBaseUrl != null && cacheAccount != null) {
                runCatching { SecureResponseCache(context).clear(requireNotNull(apiBaseUrl), requireNotNull(cacheAccount)) }
            }
            restorePreferences(sessionPreferences, previousSessionPreferences)
            restorePreferences(alertPreferences, previousAlertPreferences)
            restorePreferences(analyticsPreferences, previousAnalyticsPreferences)
            MessageAlerts.destination.value = previousDestination
            MessageAlerts.status.value = previousStatus
            analytics.setEnabled(previousAnalyticsEnabled)
        }
    }

    private fun showApp() {
        compose.setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = requireNotNull(apiBaseUrl),
                    reconcileAlerts = { _, _ -> },
                    browserContent = { route, onClose, contentPadding ->
                        OfflineBrowserSurface(route, onClose, contentPadding)
                    },
                )
            }
        }
    }

    private fun startBlockedSignInResponder(server: ServerSocket) {
        val release = requireNotNull(releaseSignInResponse)
        val received = requireNotNull(signInRequestReceived)
        responder = thread(isDaemon = true, name = "offline-sign-in-loading-fixture") {
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
                    socket.use { connection ->
                        connection.soTimeout = 5_000
                        val input = connection.getInputStream().bufferedReader(StandardCharsets.US_ASCII)
                        val requestLine = input.readLine().orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine() ?: throw IOException("EOF before request headers completed")
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) throw IOException("EOF before request body completed")
                            offset += count
                        }
                        requests += requestLine
                        received.countDown()
                        check(release.await(10, TimeUnit.SECONDS)) { "Test did not release the local sign-in response" }

                        val responseBody = """{"message":"Fictional credentials were rejected."}"""
                        val bytes = responseBody.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                        break
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
