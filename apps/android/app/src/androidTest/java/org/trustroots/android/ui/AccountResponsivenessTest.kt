package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class AccountResponsivenessTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0).apply { soTimeout = 10_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val requestReceived = CountDownLatch(1)
    private val responderError = AtomicReference<Throwable?>()
    private var responder: Thread? = null

    @After fun closeFixture() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
        assertTrue("The slow account fixture should stop after shutdown", responder?.isAlive != true)
    }

    @Test fun accountBackRemainsResponsiveDuringSlowAccountLoad() {
        responder = thread(isDaemon = true, name = "slow-account-settings-fixture") {
            try {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    return@thread
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                activeSocket.set(socket)
                socket.use {
                    socket.soTimeout = 5_000
                    val input = socket.getInputStream().bufferedReader()
                    val requestLine = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    requestReceived.countDown()
                    Thread.sleep(1_500)
                    val body =
                        """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}"""
                            .toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(body)
                    socket.getOutputStream().flush()
                    assertEquals("GET /api/users/steady-heron HTTP/1.1", requestLine)
                }
            } catch (error: IOException) {
                if (!server.isClosed) responderError.set(error)
            } catch (error: Throwable) {
                responderError.set(error)
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
        val backPressed = CountDownLatch(1)
        val session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron"))
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = session,
                onBack = { backPressed.countDown() },
                onResetPassword = {},
                onSignedOut = {},
                onSessionInvalidated = {},
            )
        }

        assertTrue("Account details request did not reach the local fixture", requestReceived.await(5, TimeUnit.SECONDS))
        compose.onNodeWithText("Account").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        assertTrue("Back did not remain responsive while account details were loading", backPressed.await(1, TimeUnit.SECONDS))

        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("member@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        responder?.join(2_000)
        assertTrue("The slow account fixture should finish its response", responder?.isAlive != true)
        assertEquals(null, responderError.get())
    }
}
