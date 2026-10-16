package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
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
import org.trustroots.android.browser.BrowserRoute

@RunWith(AndroidJUnit4::class)
class MenuAndAccountCoverageJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0).apply { soTimeout = 10_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private var accountResponder: Thread? = null

    private val session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox"))

    @Test fun menuActionsOpenTheirDestinationsAndSupportLinks() {
        val destinations = mutableListOf<String>()
        val browserRoutes = mutableListOf<BrowserRoute>()
        compose.setContent {
            MenuScreen(
                session = session,
                openProfile = { destinations.add("profile") },
                openEditProfile = { destinations.add("edit profile") },
                openHost = { destinations.add("host") },
                openNostroots = { destinations.add("Nostroots") },
                openContacts = { destinations.add("contacts") },
                openFindPeople = { destinations.add("find people") },
                openCircles = { destinations.add("circles") },
                openAccount = { destinations.add("account") },
                openBrowser = { browserRoutes.add(it) },
            )
        }

        compose.onNodeWithText("View your profile").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        compose.onNodeWithText("Host").performScrollTo().performClick()
        compose.onNodeWithText("Nostroots").performScrollTo().performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        compose.onNodeWithText("Find people").performScrollTo().performClick()
        compose.onNodeWithText("Circles").performScrollTo().performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        compose.onNodeWithText("FAQ").performScrollTo().performClick()

        assertEquals(
            listOf("profile", "edit profile", "host", "Nostroots", "contacts", "find people", "circles", "account"),
            destinations,
        )
        assertEquals(
            listOf(BrowserRoute("FAQ", "https://www.trustroots.org/faq")),
            browserRoutes,
        )
    }

    @After fun closeFixture() {
        try {
            server.close()
            activeSocket.getAndSet(null)?.close()
            accountResponder?.join(2_000)
            assertTrue("The account fixture should stop after shutdown", accountResponder?.isAlive != true)
        } finally {
            responderFailure.get()?.let { throw AssertionError("The account fixture failed", it) }
        }
    }

    @Test fun accountSettingsShowsMemberDetailsAndRoutesItsActions() {
        accountResponder = thread(isDaemon = true) {
            try {
                val socket = try {
                    server.accept()
                } catch (error: SocketTimeoutException) {
                    throw AssertionError("Timed out waiting for account settings request", error)
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                activeSocket.set(socket)
                socket.use {
                    socket.soTimeout = 5_000
                    val input = socket.getInputStream().bufferedReader()
                    val requestLine = input.readLine() ?: throw EOFException("Missing account settings request")
                    while (true) {
                        val header = input.readLine() ?: throw EOFException("Incomplete account settings headers")
                        if (header.isEmpty()) break
                    }
                    check(requestLine == "GET /api/users/quiet-fox HTTP/1.1") {
                        "Unexpected account settings request: $requestLine"
                    }
                    val body =
                        """{"username":"quiet-fox","displayName":"Quiet Fox","email":"quiet-fox@example.test","newsletter":false}"""
                            .toByteArray(Charsets.UTF_8)
                    socket.getOutputStream().apply {
                        write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(body)
                        flush()
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) responderFailure.set(error)
            } catch (error: Throwable) {
                responderFailure.set(error)
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
        var backCount = 0
        var resetCount = 0
        var signOutCount = 0
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = session,
                onBack = { backCount++ },
                onResetPassword = { resetCount++ },
                onSignedOut = { signOutCount++ },
                onSessionInvalidated = {},
            )
        }

        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("quiet-fox@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Signed in as Quiet Fox (@quiet-fox).", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Email address").assertIsDisplayed()
        compose.onNodeWithText("Community newsletter").assertIsDisplayed()
        compose.onNodeWithText("APK updates").assertDoesNotExist()

        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Forgot your password?").performScrollTo().performClick()
        compose.onNodeWithText("Sign out").performScrollTo().performClick()
        assertEquals(1, backCount)
        assertEquals(1, resetCount)
        assertEquals(1, signOutCount)
        accountResponder?.join(1_000)
        assertTrue("The account fixture should finish its response", accountResponder?.isAlive != true)
        assertEquals(null, responderFailure.get())
    }
}
