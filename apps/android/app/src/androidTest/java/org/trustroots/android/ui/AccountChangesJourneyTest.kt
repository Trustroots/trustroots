package org.trustroots.android.ui

import org.trustroots.android.ui.account.AccountSettingsScreen

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class AccountChangesJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<Pair<String, String>>()
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    @Test fun savesEmailAndRequiresMatchingPasswordConfirmation() {
        responder = thread(isDaemon = true) {
            repeat(3) {
                val socket = acceptOrStop() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    val headers = mutableListOf<String>()
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        headers += header
                    }
                    val contentLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                        ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                    val body = CharArray(contentLength)
                    var offset = 0
                    while (offset < body.size) {
                        val count = input.read(body, offset, body.size - offset)
                        if (count < 0) break
                        offset += count
                    }
                    requests += request to body.concatToString(0, offset)
                    val payload = when {
                        request.startsWith("POST /api/users/password") -> "{}"
                        request.startsWith("PUT /api/users ") ->
                            """{"username":"steady-heron","displayName":"Steady Heron","email":"new@example.test","newsletter":false}"""
                        else ->
                            """{"username":"steady-heron","displayName":"Steady Heron","email":"old@example.test","newsletter":false}"""
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Menu) {
                AccountSettingsScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("old@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Email address").performTextReplacement("new@example.test")
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Account saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Current password").performScrollTo().performTextReplacement("fictional-old-password")
        compose.onNodeWithText("New password").performScrollTo().performTextReplacement("fictional-new-password")
        compose.onNodeWithText("Verify new password").performScrollTo().performTextReplacement("different-password")
        val changePasswordButton = compose.onNode(hasText("Change password") and hasClickAction())
        changePasswordButton.performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Verify new password").performScrollTo().performTextReplacement("fictional-new-password")
        changePasswordButton.performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Password changed.").fetchSemanticsNodes().isNotEmpty()
        }

        assertEquals(3, requests.size)
        val accountBody = JSONObject(requests.first { it.first.startsWith("PUT /api/users ") }.second)
        assertEquals("new@example.test", accountBody.getString("email"))
        val passwordRequest = requests.first { it.first.startsWith("POST /api/users/password ") }
        assertFalse(passwordRequest.second.contains("different-password"))
        assertTrue(passwordRequest.second.contains("fictional-new-password"))
        compose.onNodeWithText("Password changed.").performScrollTo().assertIsDisplayed()
        responder?.join(1_000)
    }
}
