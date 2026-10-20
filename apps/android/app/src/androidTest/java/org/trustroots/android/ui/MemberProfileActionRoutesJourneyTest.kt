package org.trustroots.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
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
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class MemberProfileActionRoutesJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val session = MemberSession(
        "connect.sid=fictional-profile-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null

    @After fun closeFixture() {
        runCatching { server.close() }
        activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
        responder?.join(2_000)
        assertTrue("The local profile fixture should stop after shutdown", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The local profile fixture failed", it) }
    }

    @Test fun sendMessageOpensConversationAndBackReturnsToProfile() {
        startFixture()
        compose.setContent { showProfile() }

        waitForText("Send a message")
        compose.onNodeWithText("Send a message").performClick()
        compose.waitUntil(10_000) {
            requests.any { it.path == "/api/messages/member-two?limit=100" } &&
                compose.onAllNodesWithText("Message").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Message").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        waitForText("Send a message")

        compose.onNodeWithText("Send a message").assertIsDisplayed()
        assertTrue(requests.any { it.path == "/api/users/quiet-fox" })
        assertTrue(requests.any { it.path == "/api/messages/member-two?limit=100" })
    }

    @Test fun addContactOpensAuthenticatedBrowserRouteAndClosingReturnsToProfile() {
        startFixture()
        compose.setContent {
            showProfile { route, onClose, _ ->
                FixtureBrowser(route, onClose)
            }
        }

        waitForText("Add contact")
        compose.onNodeWithText("Add contact").performClick()
        waitForText("Fixture browser: Add contact")

        compose.onNodeWithText("Fixture browser: Add contact").assertIsDisplayed()
        compose.onNodeWithText("URL: https://www.trustroots.org/contact-add/member-two").assertIsDisplayed()
        compose.onNodeWithText("Cookie: ${session.cookieHeader}").assertIsDisplayed()
        compose.onNodeWithText("Close fixture browser").performClick()
        waitForText("Add contact")

        compose.onNodeWithText("Add contact").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Fixture browser: Add contact").fetchSemanticsNodes().isEmpty())
        assertTrue(requests.any { it.path == "/api/contact-by/member-two" })
    }

    @Composable
    private fun showProfile(
        browser: (@Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit)? = null,
    ) {
        MemberProfileScreen(
            api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
            session = session,
            username = "quiet-fox",
            onSessionInvalidated = {},
            onBack = {},
            browserContent = browser ?: { route, close, padding ->
                TrustrootsBrowser(route, close, padding)
            },
        )
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startFixture() {
        responder = thread(isDaemon = true, name = "member-profile-actions-fixture") {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        responderFailure.compareAndSet(null, AssertionError("Timed out waiting for fixture requests"))
                        return@thread
                    } catch (error: SocketException) {
                        if (server.isClosed) return@thread
                        responderFailure.compareAndSet(null, error)
                        return@thread
                    } catch (error: IOException) {
                        responderFailure.compareAndSet(null, error)
                        return@thread
                    }
                    activeSocket.set(socket)
                    try {
                        socket.soTimeout = 10_000
                        socket.use {
                            val input = socket.getInputStream()
                            val requestLine = input.readAsciiLine() ?: throw EOFException("Missing request line")
                            var contentLength = 0
                            while (true) {
                                val header = input.readAsciiLine() ?: throw EOFException("Incomplete request headers")
                                if (header.isEmpty()) break
                                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                    contentLength = header.substringAfter(':').trim().toInt()
                                }
                            }
                            val request = CapturedRequest(
                                line = requestLine,
                                path = requestLine.substringAfter(' ').substringBefore(' '),
                                body = input.readUtf8Body(contentLength),
                            )
                            requests += request
                            val response = responseFor(request.path)
                            val bytes = response.body.toByteArray(Charsets.UTF_8)
                            val output = socket.getOutputStream()
                            output.write(
                                "HTTP/1.1 ${response.status} ${response.reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            output.write(bytes)
                            output.flush()
                        }
                    } catch (_: SocketException) {
                        // Local clients can cancel requests while a screen is changing.
                    } catch (error: IOException) {
                        responderFailure.compareAndSet(null, error)
                    } catch (error: Throwable) {
                        responderFailure.compareAndSet(null, error)
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                        runCatching { socket.close() }
                    }
                }
            } catch (error: Throwable) {
                responderFailure.compareAndSet(null, error)
            }
        }
    }

    private fun responseFor(path: String): FixtureReply = when {
        path == "/api/users/quiet-fox" -> FixtureReply(
            200,
            "OK",
            """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
        )
        path == "/api/offers-by/member-two?types=host" -> FixtureReply(200, "OK", "[]")
        path == "/api/contacts/member-two" -> FixtureReply(200, "OK", "[]")
        path == "/api/experiences?userTo=member-two" -> FixtureReply(200, "OK", "[]")
        path == "/api/contact-by/member-two" -> FixtureReply(404, "Not Found", "{}")
        path == "/api/messages/member-two?limit=100" -> FixtureReply(200, "OK", "[]")
        path.contains("/avatar?") -> FixtureReply(404, "Not Found", "")
        else -> FixtureReply(404, "Not Found", "{}")
    }

    private data class CapturedRequest(val line: String, val path: String, val body: String)
    private data class FixtureReply(val status: Int, val reason: String, val body: String)
}

@Composable
private fun FixtureBrowser(route: BrowserRoute, onClose: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Fixture browser: ${route.title}")
        Text("URL: ${route.url}")
        Text("Cookie: ${route.sessionCookie}")
        TextButton(onClick = onClose) { Text("Close fixture browser") }
    }
}

private fun java.io.InputStream.readAsciiLine(): String? {
    val bytes = ByteArrayOutputStream()
    var previous = -1
    while (true) {
        val next = read()
        if (next < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
        if (previous == '\r'.code && next == '\n'.code) {
            val line = bytes.toByteArray()
            return String(line, 0, line.size - 1, Charsets.US_ASCII)
        }
        bytes.write(next)
        previous = next
    }
}

private fun java.io.InputStream.readUtf8Body(contentLength: Int): String {
    val body = ByteArray(contentLength)
    var offset = 0
    while (offset < contentLength) {
        val count = read(body, offset, contentLength - offset)
        if (count < 0) throw EOFException("Request body ended after $offset of $contentLength bytes")
        offset += count
    }
    return body.toString(Charsets.UTF_8)
}
