package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import android.Manifest
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.material3.Text
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.ActivityOptionsCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.io.EOFException
import java.io.IOException
import java.time.Instant
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Before
import org.junit.Assume.assumeTrue
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.R
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.inbox.MessageInboxScreen

@RunWith(AndroidJUnit4::class)
class PopulatedInboxJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0).apply { soTimeout = 300 }
    private val session = MemberSession(
        "connect.sid=fictional-inbox-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private val dismissalPreferences
        get() = InstrumentationRegistry.getInstrumentation().targetContext
            .getSharedPreferences("inbox-message-alert-prompt", Context.MODE_PRIVATE)
    private var previousDismissal: Boolean? = null
    private var previousAlertMetadata: MessageAlertStatusMetadata? = null
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @Before fun isolateMessageAlertPrompt() {
        previousAlertMetadata = MessageAlerts.statusMetadata.value
        MessageAlerts.statusMetadata.value = null
        previousDismissal = if (dismissalPreferences.contains(session.member.username)) {
            dismissalPreferences.getBoolean(session.member.username, false)
        } else null
        dismissalPreferences.edit().remove(session.member.username).commit()
    }

    @After fun stopResponder() {
        server.close()
        activeSocket?.close()
        responder?.join(1_500)
        assertTrue("The local inbox responder should stop after server shutdown", responder?.isAlive != true)
        if (previousDismissal == null) dismissalPreferences.edit().remove(session.member.username).commit()
        else dismissalPreferences.edit().putBoolean(session.member.username, previousDismissal!!).commit()
        MessageAlerts.statusMetadata.value = previousAlertMetadata
    }

    @Test fun filtersConversationsAndOpensThenReturnsFromMemberProfile() {
        startResponder { request ->
            when {
                request.startsWith("GET /api/messages?") -> "200 OK" to inboxPayload()
                request.startsWith("GET /api/users/quiet-fox ") ->
                    "200 OK" to """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","description":"A fictional profile for a neighbour."}"""
                request.contains("/avatar?") -> "404 Not Found" to ""
                request.startsWith("GET /api/offers-by/") -> "200 OK" to "[]"
                request.startsWith("GET /api/contacts/") -> "200 OK" to "[]"
                request.startsWith("GET /api/experiences?") -> "200 OK" to "[]"
                request.startsWith("GET /api/contact-by/") -> "404 Not Found" to "{}"
                else -> "404 Not Found" to "{}"
            }
        }
        compose.setContent {
            TrustrootsTheme {
                MessageInboxScreen(api(), session, onSessionInvalidated = {})
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("Amber Owl").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().performTextReplacement("  quiet-fox ")
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Amber Owl").assertDoesNotExist()

        compose.onNodeWithTag("messageInboxFilter").performScrollTo().performTextReplacement("no-such-member")
        compose.onNodeWithTag("message-thread-thread-fox").assertDoesNotExist()
        compose.onNodeWithTag("message-thread-thread-owl").assertDoesNotExist()
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().performTextReplacement("quiet-fox")
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Amber Owl").assertDoesNotExist()
        compose.onNodeWithText("Profile").performClick()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional profile for a neighbour.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional profile for a neighbour.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Amber Owl").assertDoesNotExist()
        assertTrue(requests.any { it.startsWith("GET /api/users/quiet-fox ") })
        assertFalse(requests.any { it.startsWith("GET /api/messages/member-fox?") })
    }

    @Test fun inboxPromptRefreshesAfterOneTapEnrolment() {
        startResponder { request ->
            when {
                request.startsWith("GET /api/messages?") -> "200 OK" to "[]"
                else -> "404 Not Found" to "{}"
            }
        }
        val enableCalls = AtomicInteger()
        val alertsEnabled = mutableStateOf(false)
        val resultCallback = AtomicReference<((MessageAlertStatusMetadata) -> Unit)?>(null)
        val grantedContext = object : ContextWrapper(compose.activity) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_GRANTED
                else super.checkSelfPermission(permission)
        }
        compose.setContent {
            CompositionLocalProvider(LocalContext provides grantedContext) {
                TrustrootsTheme {
                    MessageInboxScreen(
                        api(),
                        session,
                        onSessionInvalidated = {},
                        enableMessageAlerts = { _, _, onResult ->
                            enableCalls.incrementAndGet()
                            resultCallback.set(onResult)
                        },
                        isMessageAlertsEnabled = { _, _ -> alertsEnabled.value },
                    )
                }
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Get message notifications").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Turn on").performScrollTo().performClick()
        compose.waitUntil(5_000) { enableCalls.get() == 1 }
        assertTrue("One tap should start enrolment when notification permission is already granted", enableCalls.get() == 1)
        compose.onNodeWithText("Enabling…").assertIsDisplayed().assertIsNotEnabled()
        compose.runOnIdle {
            alertsEnabled.value = true
            requireNotNull(resultCallback.get())(MessageAlertStatusMetadata(R.string.message_alerts_waiting_registration))
        }
        compose.onNodeWithText("Setting up message alerts. Please wait.")
            .performScrollTo().assertIsDisplayed()
        compose.runOnIdle {
            MessageAlerts.statusMetadata.value = MessageAlertStatusMetadata(R.string.message_alerts_ready)
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithTag("inboxMessageAlertsPrompt").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithTag("inboxMessageAlertsPrompt").assertDoesNotExist()
    }

    @Test fun inboxPromptCanBeDismissedWithoutEnablingAlerts() {
        startResponder { request ->
            if (request.startsWith("GET /api/messages?")) "200 OK" to "[]" else "404 Not Found" to "{}"
        }
        val showInbox = mutableStateOf(true)
        compose.setContent {
            TrustrootsTheme {
                if (showInbox.value) {
                    MessageInboxScreen(
                        api(), session, onSessionInvalidated = {},
                        enableMessageAlerts = { _, _, _ -> error("Dismissal must not start enrolment") },
                        isMessageAlertsEnabled = { _, _ -> false },
                    )
                } else Text("Inbox temporarily hidden")
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Get message notifications").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Not now").performScrollTo().performClick()
        compose.onNodeWithTag("inboxMessageAlertsPrompt").assertDoesNotExist()
        compose.runOnIdle { showInbox.value = false }
        compose.waitForIdle()
        compose.runOnIdle { showInbox.value = true }
        compose.waitForIdle()
        compose.onNodeWithTag("inboxMessageAlertsPrompt").assertDoesNotExist()
    }

    @Test fun inboxPromptShowsTheEnrolmentErrorResource() {
        startResponder { request ->
            if (request.startsWith("GET /api/messages?")) "200 OK" to "[]" else "404 Not Found" to "{}"
        }
        val alertsEnabled = mutableStateOf(false)
        val nextEnrolmentResult = mutableStateOf(R.string.message_alerts_waiting_registration)
        val grantedContext = object : ContextWrapper(compose.activity) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_GRANTED
                else super.checkSelfPermission(permission)
        }
        compose.setContent {
            CompositionLocalProvider(LocalContext provides grantedContext) {
                TrustrootsTheme {
                    MessageInboxScreen(
                        api(), session, onSessionInvalidated = {},
                        enableMessageAlerts = { _, _, onResult ->
                            alertsEnabled.value = true
                            onResult(MessageAlertStatusMetadata(nextEnrolmentResult.value))
                        },
                        isMessageAlertsEnabled = { _, _ -> alertsEnabled.value },
                    )
                }
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Get message notifications").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Turn on").performScrollTo().performClick()
        compose.onNodeWithText("Setting up message alerts. Please wait.")
            .performScrollTo().assertIsDisplayed()
        compose.runOnIdle {
            MessageAlerts.statusMetadata.value = MessageAlertStatusMetadata(R.string.message_alerts_registration_failed)
        }
        compose.onNodeWithText("Check your internet connection, then turn alerts off and back on in Account → Message alerts.", substring = true)
            .performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("inboxMessageAlertsStatus").performScrollTo().assertIsDisplayed()
        compose.runOnIdle {
            nextEnrolmentResult.value = R.string.message_alerts_not_configured
        }
        compose.onNodeWithText("Turn on").performScrollTo().performClick()
        compose.onNodeWithText("Message alerts are not available right now. Email reminders are still available.")
            .performScrollTo().assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android-message-alerts-unavailable-email-alternative")
    }

    @Test fun inboxPromptReportsNotificationPermissionDenial() {
        assumeTrue("The notification permission gate starts on Android 13", android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
        startResponder { request ->
            if (request.startsWith("GET /api/messages?")) "200 OK" to "[]" else "404 Not Found" to "{}"
        }
        val enableCalls = AtomicInteger()
        val deniedContext = object : ContextWrapper(compose.activity) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_DENIED
                else super.checkSelfPermission(permission)
        }
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides deniedContext,
                LocalActivityResultRegistryOwner provides TestActivityResultRegistryOwner(PermissionResultRegistry(granted = false)),
            ) {
                TrustrootsTheme {
                    MessageInboxScreen(
                        api(), session, onSessionInvalidated = {},
                        enableMessageAlerts = { _, _, _ -> enableCalls.incrementAndGet() },
                        isMessageAlertsEnabled = { _, _ -> false },
                    )
                }
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Get message notifications").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Turn on").performScrollTo().performClick()
        compose.onNodeWithText("Allow notifications in Android settings to receive message alerts.")
            .performScrollTo().assertIsDisplayed()
        assertTrue("Denied permission must prevent push enrolment", enableCalls.get() == 0)
    }

    @Test fun inboxPermissionGrantContinuesIntoEnrolment() {
        assumeTrue("The notification permission gate starts on Android 13", android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
        startResponder { request ->
            if (request.startsWith("GET /api/messages?")) "200 OK" to "[]" else "404 Not Found" to "{}"
        }
        val enableCalls = AtomicInteger()
        val deniedContext = object : ContextWrapper(compose.activity) {
            override fun checkSelfPermission(permission: String): Int =
                if (permission == Manifest.permission.POST_NOTIFICATIONS) PackageManager.PERMISSION_DENIED
                else super.checkSelfPermission(permission)
        }
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides deniedContext,
                LocalActivityResultRegistryOwner provides TestActivityResultRegistryOwner(PermissionResultRegistry(granted = true)),
            ) {
                TrustrootsTheme {
                    MessageInboxScreen(
                        api(), session, onSessionInvalidated = {},
                        enableMessageAlerts = { _, _, onResult ->
                            enableCalls.incrementAndGet()
                            onResult(MessageAlertStatusMetadata(R.string.message_alerts_ready))
                        },
                        isMessageAlertsEnabled = { _, _ -> false },
                    )
                }
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Get message notifications").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Turn on").performScrollTo().performClick()
        compose.waitUntil(5_000) { enableCalls.get() == 1 }
        assertTrue("Granting notification permission should continue into message alert enrolment", enableCalls.get() == 1)
    }

    @Test fun inboxDoesNotPromptWhenAlertsAreAlreadyEnabled() {
        startResponder { request ->
            if (request.startsWith("GET /api/messages?")) "200 OK" to "[]" else "404 Not Found" to "{}"
        }
        compose.setContent {
            TrustrootsTheme {
                MessageInboxScreen(
                    api(), session, onSessionInvalidated = {},
                    enableMessageAlerts = { _, _, _ -> error("Already enabled alerts must not enrol again") },
                    isMessageAlertsEnabled = { _, _ -> true },
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("No conversations yet.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("inboxMessageAlertsPrompt").assertDoesNotExist()
    }

    @Test fun openingConversationAndReturningReloadsThePopulatedInbox() {
        startResponder { request ->
            when {
                request.startsWith("GET /api/messages?") -> "200 OK" to inboxPayload()
                request.startsWith("GET /api/users/mini/member-fox ") -> "200 OK" to
                    """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}"""
                request.startsWith("GET /api/messages/member-fox?") -> "200 OK" to
                    """[{"_id":"message-one","content":"A fictional note from the neighbour.","created":"${Instant.parse("2025-02-03T04:05:06Z")}","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}}]"""
                request.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to "{}"
            }
        }
        compose.setContent {
            TrustrootsTheme {
                MessageInboxScreen(api(), session, onSessionInvalidated = {})
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional message from a neighbour.").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional note from the neighbour.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional note from the neighbour.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.waitUntil(10_000) {
            requests.count { it.startsWith("GET /api/messages?") } >= 2 &&
                compose.onAllNodesWithText("Amber Owl").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Amber Owl").assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/messages/member-fox?") })
    }

    @Test fun tappingTheOpenAreaAtTheEndOfAnInboxRowOpensItsConversation() {
        startResponder { request ->
            when {
                request.startsWith("GET /api/messages?") -> "200 OK" to inboxPayload()
                request.startsWith("GET /api/users/mini/member-fox ") -> "200 OK" to
                    """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}"""
                request.startsWith("GET /api/messages/member-fox?") -> "200 OK" to
                    """[{"_id":"message-one","content":"A fictional note from the neighbour.","created":"${Instant.parse("2025-02-03T04:05:06Z")}","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}}]"""
                request.contains("/avatar?") -> "404 Not Found" to ""
                else -> "404 Not Found" to "{}"
            }
        }
        compose.setContent {
            TrustrootsTheme {
                MessageInboxScreen(api(), session, onSessionInvalidated = {})
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        val rootBounds = compose.onRoot().fetchSemanticsNode().boundsInRoot
        val row = compose.onNodeWithTag("message-thread-thread-fox")
        compose.onNodeWithText("Just now").assertIsDisplayed()
        val rowBounds = row.fetchSemanticsNode().boundsInRoot
        val edgeTolerance = with(compose.density) { 1.dp.toPx() }
        assertTrue("Inbox row should start at the list's full-width edge", rowBounds.left <= rootBounds.left + edgeTolerance)
        assertTrue("Inbox row should extend to the list's full-width edge", rowBounds.right >= rootBounds.right - edgeTolerance)
        val profileBounds = compose.onAllNodesWithText("Profile").fetchSemanticsNodes().first().boundsInRoot
        val rowCentreY = (rowBounds.top + rowBounds.bottom) / 2f
        val profileCentreY = (profileBounds.top + profileBounds.bottom) / 2f
        assertTrue(
            "Profile action should be vertically centred in its inbox row",
            kotlin.math.abs(profileCentreY - rowCentreY) <= edgeTolerance,
        )
        row.performTouchInput {
            click(Offset(width - 4f, height / 2f))
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional note from the neighbour.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional note from the neighbour.").assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/messages/member-fox?") })
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun inboxPayload(): String =
        """[{"_id":"thread-fox","updated":"2099-01-01T00:00:00Z","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional message from a neighbour."},"read":false},{"_id":"thread-owl","userFrom":{"_id":"member-owl","username":"amber-owl","displayName":"Amber Owl"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional note about a bicycle."},"read":true}]"""

    private fun startResponder(responseFor: (String) -> Pair<String, String>) {
        responder = thread(isDaemon = true, name = "populated-inbox-local-api") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket = socket
                try {
                    socket.use { connection ->
                        connection.soTimeout = 1_000
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = input.readLine() ?: break
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        val requestBody = CharArray(contentLength)
                        var bodyOffset = 0
                        while (bodyOffset < requestBody.size) {
                            val count = input.read(requestBody, bodyOffset, requestBody.size - bodyOffset)
                            if (count < 0) throw EOFException("Request ended before Content-Length bytes were read")
                            bodyOffset += count
                        }
                        requests += request
                        val (status, body) = responseFor(request)
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

    private class TestActivityResultRegistryOwner(
        override val activityResultRegistry: ActivityResultRegistry,
    ) : ActivityResultRegistryOwner

    private class PermissionResultRegistry(private val granted: Boolean) : ActivityResultRegistry() {
        @Suppress("UNCHECKED_CAST")
        override fun <I, O> onLaunch(
            requestCode: Int,
            contract: ActivityResultContract<I, O>,
            input: I,
            options: ActivityOptionsCompat?,
        ) {
            dispatchResult(requestCode, granted as O)
        }
    }
}
