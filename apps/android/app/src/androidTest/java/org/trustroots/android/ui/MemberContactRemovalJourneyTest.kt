package org.trustroots.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
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
class MemberContactRemovalJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val activeSocket = AtomicReference<Socket?>()
    private val deleteAttempts = AtomicInteger()
    private val deleteReceived = CountDownLatch(1)
    private val releaseDeleteResponse = CountDownLatch(1)
    private var deferDeleteResponse = false
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
    }

    @Test fun cancellingConfirmedContactRemovalKeepsRelationshipAndSendsNoDelete() {
        startResponder(confirmed = true)
        compose.setContent { profile() }

        waitForText("Remove contact")
        compose.onNodeWithText("Remove contact").performClick()
        compose.onNodeWithText("Remove contact?").assertIsDisplayed()
        compose.onNodeWithText("You will no longer be contacts with this member.").assertIsDisplayed()
        compose.onNodeWithText("Cancel").performClick()

        compose.onNodeWithText("Remove contact").assertIsDisplayed()
        assertFalse(compose.onAllNodesWithText("Remove contact?").fetchSemanticsNodes().isNotEmpty())
        assertFalse(requests.any { it.method == "DELETE" })
    }

    @Test fun confirmsPendingContactRequestRemovalAndReturnsToAddContact() {
        startResponder(confirmed = false)
        compose.setContent { profile() }

        waitForText("Delete contact request")
        compose.onNodeWithText("Delete contact request").performClick()
        compose.onNodeWithText("Delete contact request?").assertIsDisplayed()
        compose.onNodeWithText("This cancels the pending contact request.").assertIsDisplayed()
        compose.onNodeWithText("Confirm").performClick()

        compose.waitUntil(10_000) {
            requests.any { it.method == "DELETE" && it.path == "/api/contact/contact-two" } &&
                compose.onAllNodesWithText("Add contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Add contact").assertIsDisplayed()
        assertTrue(requests.any { it.method == "DELETE" && it.path == "/api/contact/contact-two" })
        assertFalse(compose.onAllNodesWithText("Delete contact request?").fetchSemanticsNodes().isNotEmpty())
    }

    @Test fun keepsConfirmedRemovalDialogAfterServiceFailureAndReportsExpiredSessionOnRetry() {
        startResponder(confirmed = true, deleteStatuses = listOf(503, 401))
        val invalidations = AtomicInteger()
        compose.setContent { profile(onSessionInvalidated = { invalidations.incrementAndGet() }) }

        waitForText("Remove contact")
        compose.onNodeWithText("Remove contact").performClick()
        compose.onNodeWithText("Confirm").performClick()
        compose.waitUntil(10_000) {
            deleteAttempts.get() == 1 && runCatching {
                compose.onNodeWithText("Confirm").assertIsEnabled()
                true
            }.getOrDefault(false)
        }
        compose.onNodeWithText("Remove contact?").assertIsDisplayed()
        assertEquals(0, invalidations.get())

        compose.onNodeWithText("Confirm").performClick()
        compose.waitUntil(10_000) { invalidations.get() == 1 }
        compose.onNodeWithText("Remove contact?").assertIsDisplayed()
        assertEquals(2, deleteAttempts.get())
        assertEquals(2, requests.count { it.method == "DELETE" && it.path == "/api/contact/contact-two" })
    }

    @Test fun systemBackDoesNotDismissRemovalDialogWhileDeleteIsInProgress() {
        deferDeleteResponse = true
        startResponder(confirmed = true, deleteStatuses = listOf(503))
        compose.setContent { profile() }

        waitForText("Remove contact")
        compose.onNodeWithText("Remove contact").performClick()
        compose.onNodeWithText("Confirm").performClick()
        try {
            assertTrue("The local delete request should start", deleteReceived.await(10, TimeUnit.SECONDS))

            Espresso.pressBack()
            compose.onNodeWithText("Remove contact?").assertIsDisplayed()
            compose.onNodeWithText("Removing…").assertIsNotEnabled()

            releaseDeleteResponse.countDown()
            compose.waitUntil(10_000) {
                runCatching {
                    compose.onNodeWithText("Confirm").assertIsEnabled()
                    true
                }.getOrDefault(false)
            }
            compose.onNodeWithText("Remove contact?").assertIsDisplayed()
            assertEquals(1, deleteAttempts.get())
        } finally {
            releaseDeleteResponse.countDown()
        }
    }

    @Composable
    private fun profile(onSessionInvalidated: () -> Unit = {}) = MemberProfileScreen(
        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
        session = session,
        username = "quiet-fox",
        onSessionInvalidated = onSessionInvalidated,
        onBack = {},
    )

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startResponder(confirmed: Boolean, deleteStatuses: List<Int> = listOf(200)) {
        responder = thread(isDaemon = true, name = "member-contact-removal-fixture") {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        return@thread
                    } catch (error: SocketException) {
                        if (server.isClosed) return@thread else throw error
                    }
                    activeSocket.set(socket)
                    try {
                        socket.soTimeout = 5_000
                        socket.use {
                            val input = socket.getInputStream()
                            val requestLine = readLine(input).orEmpty()
                            var contentLength = 0
                            while (true) {
                                val header = readLine(input) ?: break
                                if (header.isEmpty()) break
                                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                    contentLength = header.substringAfter(':').trim().toInt()
                                }
                            }
                            val request = CapturedRequest(
                                method = requestLine.substringBefore(' '),
                                path = requestLine.substringAfter(' ').substringBefore(' '),
                                body = String(readBody(input, contentLength), Charsets.UTF_8),
                            )
                            requests += request
                            val response = responseFor(request, confirmed, deleteStatuses)
                            val bytes = response.body.toByteArray(Charsets.UTF_8)
                            val reason = when (response.status) {
                                200 -> "OK"
                                401 -> "Unauthorized"
                                404 -> "Not Found"
                                503 -> "Service Unavailable"
                                else -> "Fixture Response"
                            }
                            val output = socket.getOutputStream()
                            output.write(
                                "HTTP/1.1 ${response.status} $reason\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                            )
                            output.write(bytes)
                            output.flush()
                        }
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) throw error
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
    }

    private fun responseFor(
        request: CapturedRequest,
        confirmed: Boolean,
        deleteStatuses: List<Int>,
    ): FixtureResponse = when {
        request.method == "GET" && request.path == "/api/users/quiet-fox" -> FixtureResponse(
            200,
            """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
        )
        request.method == "GET" && request.path == "/api/offers-by/member-two?types=host" -> FixtureResponse(200, "[]")
        request.method == "GET" && request.path == "/api/contacts/member-two" -> FixtureResponse(200, "[]")
        request.method == "GET" && request.path == "/api/experiences?userTo=member-two" -> FixtureResponse(200, "[]")
        request.method == "GET" && request.path == "/api/contact-by/member-two" -> FixtureResponse(
            200,
            """{"_id":"contact-two","confirmed":$confirmed}""",
        )
        request.method == "DELETE" && request.path == "/api/contact/contact-two" -> {
            val attempt = deleteAttempts.incrementAndGet()
            if (deferDeleteResponse) {
                deleteReceived.countDown()
            }
            if (deferDeleteResponse && !releaseDeleteResponse.await(8, TimeUnit.SECONDS)) {
                FixtureResponse(503, "{\"message\":\"Local contact operation failed.\"}")
            } else {
                val status = deleteStatuses.getOrElse(attempt - 1) { 200 }
                val body = if (status in 200..299) "{}" else """{"message":"Local contact operation failed."}"""
                FixtureResponse(status, body)
            }
        }
        request.path.contains("/avatar?") -> FixtureResponse(404, "")
        else -> FixtureResponse(404, "{}")
    }

    private fun readLine(input: java.io.InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val next = input.read()
            if (next < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            if (next == '\n'.code) {
                val line = bytes.toByteArray()
                val length = if (line.lastOrNull() == '\r'.code.toByte()) line.size - 1 else line.size
                return String(line, 0, length, Charsets.US_ASCII)
            }
            bytes.write(next)
        }
    }

    private fun readBody(input: java.io.InputStream, contentLength: Int): ByteArray {
        val body = ByteArray(contentLength)
        var offset = 0
        while (offset < contentLength) {
            val count = input.read(body, offset, contentLength - offset)
            if (count < 0) throw IOException("Request body ended before Content-Length")
            offset += count
        }
        return body
    }

    private data class CapturedRequest(val method: String, val path: String, val body: String)
    private data class FixtureResponse(val status: Int, val body: String)
}
