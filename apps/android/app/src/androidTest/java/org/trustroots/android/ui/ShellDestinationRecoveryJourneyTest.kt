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
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.analytics.AndroidUsageAnalytics
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ShellDestinationRecoveryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-shell-session",
        MobileMember("steady-heron", "Steady Heron"),
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

    @Before fun isolateShellAndAlertState() {
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

    @After fun restoreStateAndStopResponder() {
        compose.activityRule.scenario.close()
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        restorePreferences(analyticsPreferences, previousAnalyticsPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
        analytics.setEnabled(previousAnalyticsEnabled)
    }

    @Test fun notificationForTheSignedInAccountOpensItsConversation() {
        startResponder(populatedInbox = true)
        showShell(MessageDestination("steady-heron", "member-sender"))

        waitForText("A fictional message opened from an alert.")
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("A fictional message opened from an alert.").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        compose.waitUntil(5_000) { MessageAlerts.destination.value == null }
        assertTrue(requests.any { it.startsWith("GET /api/messages/member-sender?limit=100 ") })
    }

    @Test fun notificationForAnotherAccountIsClearedWithoutLeavingCircles() {
        startResponder(populatedInbox = false)
        showShell(MessageDestination("another-member", "member-sender"))

        waitForText("Discover circles")
        compose.waitUntil(5_000) { MessageAlerts.destination.value == null }
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        assertTrue(requests.none { it.startsWith("GET /api/messages/member-sender?limit=100 ") })
    }

    @Test fun matchingNotificationWaitsForDirtyProfileDecisionBeforeOpeningConversation() {
        startResponder(populatedInbox = true)
        showShell(destination = null)

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        waitForText("Tagline")
        compose.onNodeWithText("Tagline").performTextReplacement("A changed fictional tagline")

        compose.runOnIdle {
            MessageAlerts.destination.value = MessageDestination("steady-heron", "member-sender")
        }
        waitForText("Discard changes?")
        compose.onNodeWithText("A changed fictional tagline").assertIsDisplayed()
        assertTrue(requests.none { it.startsWith("GET /api/messages/member-sender?limit=100 ") })

        compose.onNodeWithText("Discard changes").performClick()
        waitForText("A fictional message opened from an alert.")
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        assertTrue(requests.any { it.startsWith("GET /api/messages/member-sender?limit=100 ") })
        compose.waitUntil(5_000) { MessageAlerts.destination.value == null }
    }

    private fun showShell(destination: MessageDestination?) {
        SecureMobileSessionStore(context).save(session)
        MessageAlerts.destination.value = destination
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

    private fun startResponder(populatedInbox: Boolean) {
        responder = thread(isDaemon = true, name = "shell-destination-local-api") {
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
                        val (status, body) = fixtureResponse(request, populatedInbox)
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
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun fixtureResponse(request: String, populatedInbox: Boolean): Pair<String, String> = when {
        request.contains("/avatar?") -> "404 Not Found" to ""
        request.startsWith("GET /api/users/steady-heron ") -> "200 OK" to
            """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}"""
        request.startsWith("GET /api/messages?page=") -> "200 OK" to if (populatedInbox) {
            """[{"_id":"thread-one","userFrom":{"_id":"member-sender","username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional alert message."},"read":false}]"""
        } else {
            "[]"
        }
        request.startsWith("GET /api/users/mini/member-sender ") -> "200 OK" to
            """{"_id":"member-sender","username":"quiet-fox","displayName":"Quiet Fox"}"""
        request.startsWith("GET /api/messages/member-sender?limit=100 ") -> "200 OK" to
            """[{"_id":"message-one","content":"A fictional message opened from an alert.","userFrom":{"_id":"member-sender","username":"quiet-fox","displayName":"Quiet Fox"},"created":"2025-02-03T04:05:06Z"}]"""
        request.startsWith("GET /api/tribes?limit=150 ") -> "200 OK" to "[]"
        request.startsWith("GET /api/users/memberships ") -> "200 OK" to "[]"
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
