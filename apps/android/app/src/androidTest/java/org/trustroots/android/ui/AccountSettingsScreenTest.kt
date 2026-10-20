package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class AccountSettingsScreenTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun showsEmailNewsletterAndPasswordControls() {
        thread(isDaemon = true) {
            repeat(4) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload =
                        """{"username":"river-otter","displayName":"River Otter","email":"river@example.test","newsletter":true}"""
                    val body = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(body)
                }
            }
        }
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                onSessionInvalidated = {},
                onBack = {},
                onResetPassword = {},
                onSignedOut = {},
            )
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("river@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Account").assertIsDisplayed()
        compose.onNodeWithText("Community newsletter").assertIsDisplayed()
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Sign out").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Turn on message alerts").performScrollTo().assertIsDisplayed()
        compose.onNode(hasText("Usage analytics") and hasClickAction()).performScrollTo().assertIsDisplayed()
    }

    @Test fun forgotPasswordPromptsBeforeLeavingDirtyAccountAndKeepsEdits() {
        val resetPassword = AtomicBoolean(false)
        showAccountSettings(onResetPassword = { resetPassword.set(true) }, onSignedOut = {})

        changeEmailToUnsavedValue()
        compose.onNodeWithText("Forgot your password?").performScrollTo().performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        assertFalse(resetPassword.get())

        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Email address").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("updated@example.test").assertIsDisplayed()

        compose.onNodeWithText("Forgot your password?").performScrollTo().performClick()
        compose.onNodeWithText("Discard changes").performClick()
        compose.waitUntil(5_000) { resetPassword.get() }
        assertTrue(resetPassword.get())
    }

    @Test fun signOutPromptsBeforeLeavingDirtyAccountAndKeepsEdits() {
        val signedOut = AtomicBoolean(false)
        showAccountSettings(onResetPassword = {}, onSignedOut = { signedOut.set(true) })

        changeEmailToUnsavedValue()
        compose.onNodeWithText("Sign out").performScrollTo().performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        assertFalse(signedOut.get())

        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Email address").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("updated@example.test").assertIsDisplayed()

        compose.onNodeWithText("Sign out").performScrollTo().performClick()
        compose.onNodeWithText("Discard changes").performClick()
        compose.waitUntil(5_000) { signedOut.get() }
        assertTrue(signedOut.get())
    }

    @Test fun eachPasswordFieldPromptsBeforeLeavingAndClearingRestoresCleanState() {
        val resetPassword = AtomicBoolean(false)
        showAccountSettings(onResetPassword = { resetPassword.set(true) }, onSignedOut = {})

        listOf("Current password", "New password", "Verify new password").forEach { label ->
            compose.onNodeWithText(label).performScrollTo().performTextReplacement("fictional-unsaved-password")
            compose.onNodeWithText("Forgot your password?").performScrollTo().performClick()
            compose.onNodeWithText("Discard changes?").assertIsDisplayed()
            assertFalse(resetPassword.get())
            compose.onNodeWithText("Keep editing").performClick()
            compose.onNodeWithText(label).performScrollTo().performTextReplacement("")
        }

        compose.onNodeWithText("Forgot your password?").performScrollTo().performClick()
        compose.onNodeWithText("Discard changes?").assertDoesNotExist()
        compose.waitUntil(5_000) { resetPassword.get() }
        assertTrue(resetPassword.get())
    }

    private fun showAccountSettings(onResetPassword: () -> Unit, onSignedOut: () -> Unit) {
        val responder = thread(isDaemon = true) {
            repeat(2) { index ->
                val socket = try { server.accept() } catch (_: SocketException) { return@thread }
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    assertTrue(
                        if (index == 0) request == "GET /api/users/quiet-fox HTTP/1.1"
                        else request == "POST /api/auth/signout HTTP/1.1",
                    )
                    val payload = if (index == 0) {
                        """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet-fox@example.test","newsletter":false}"""
                    } else "{}"
                    val body = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(body)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                onSessionInvalidated = {},
                onBack = {},
                onResetPassword = onResetPassword,
                onSignedOut = onSignedOut,
                disableMessageAlerts = { _, _ -> },
            )
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("quiet-fox@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        responder.join(1_000)
    }

    private fun changeEmailToUnsavedValue() {
        compose.onNodeWithText("Email address")
            .performScrollTo()
            .performTextReplacement("updated@example.test")
    }
}
