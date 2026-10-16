package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
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
class MemberProfileRelationshipFallbackJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-profile-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val invalidationCount = AtomicInteger()
    private val relationshipFailureServed = AtomicBoolean(false)
    private var responder: Thread? = null

    @After fun stopFixture() {
        runCatching { compose.waitForIdle() }
        activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
        runCatching { server.close() }
        responder?.join(2_000)
        assertTrue("The local profile fixture should stop after shutdown", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The local profile fixture failed", it) }
    }

    @Test fun profileOffersAddContactWhenRelationshipLookupFailsWithoutInvalidatingSession() {
        startFixture()
        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = { invalidationCount.incrementAndGet() },
                onBack = {},
            )
        }

        val requiredPaths = listOf(
            "GET /api/users/quiet-fox ",
            "GET /api/offers-by/member-two?types=host ",
            "GET /api/contacts/member-two ",
            "GET /api/experiences?userTo=member-two ",
            "GET /api/contact-by/member-two ",
        )
        compose.waitUntil(10_000) {
            relationshipFailureServed.get() &&
                requiredPaths.all { path -> requests.any { it.startsWith(path) } } &&
                compose.onAllNodesWithText("Add contact").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Add contact").performScrollTo().assertIsDisplayed()
        assertEquals("A non-auth relationship error must not invalidate the session", 0, invalidationCount.get())
        assertTrue(requests.any { it.startsWith("GET /api/contact-by/member-two ") })
        assertTrue(requests.all { it.startsWith("GET ") })
    }

    private fun startFixture() {
        responder = thread(isDaemon = true, name = "profile-relationship-fallback-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread
                    responderFailure.compareAndSet(null, error)
                    return@thread
                } catch (error: IOException) {
                    if (!server.isClosed) responderFailure.compareAndSet(null, error)
                    return@thread
                }

                activeSocket.set(socket)
                try {
                    socket.soTimeout = 10_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader(Charsets.US_ASCII)
                        val request = input.readLine() ?: throw IOException("Missing request line")
                        while (true) {
                            val header = input.readLine() ?: throw IOException("Incomplete request headers")
                            if (header.isEmpty()) break
                        }
                        requests += request
                        val reply = responseFor(request)
                        val body = reply.body.toByteArray(Charsets.UTF_8)
                        val output = connection.getOutputStream()
                        val headers = (
                            "HTTP/1.1 ${reply.status} ${reply.reason}\r\n" +
                                "Content-Type: application/json; charset=utf-8\r\n" +
                                "Content-Length: ${body.size}\r\n" +
                                "Connection: close\r\n\r\n"
                            ).toByteArray(Charsets.US_ASCII)
                        output.write(headers)
                        output.write(body)
                        output.flush()
                    }
                } catch (_: SocketException) {
                    // The client can cancel a request while the profile is disposed.
                } catch (error: IOException) {
                    responderFailure.compareAndSet(null, error)
                } catch (error: Throwable) {
                    responderFailure.compareAndSet(null, error)
                } finally {
                    activeSocket.compareAndSet(socket, null)
                    runCatching { socket.close() }
                }
            }
        }
    }

    private fun responseFor(request: String): FixtureReply {
        val path = request.substringAfter(' ').substringBefore(' ')
        return when {
            path == "/api/users/quiet-fox" -> FixtureReply(
                200,
                "OK",
                """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
            )
            path == "/api/offers-by/member-two?types=host" -> FixtureReply(200, "OK", "[]")
            path == "/api/contact-by/member-two" -> {
                relationshipFailureServed.set(true)
                FixtureReply(
                    503,
                    "Service Unavailable",
                    """{"message":"Relationship lookup is temporarily unavailable."}""",
                )
            }
            path == "/api/contacts/member-two" -> FixtureReply(200, "OK", "[]")
            path == "/api/experiences?userTo=member-two" -> FixtureReply(200, "OK", "[]")
            path.contains("/avatar?") -> FixtureReply(404, "Not Found", "")
            else -> FixtureReply(404, "Not Found", "{}")
        }
    }

    private data class FixtureReply(val status: Int, val reason: String, val body: String)
}
