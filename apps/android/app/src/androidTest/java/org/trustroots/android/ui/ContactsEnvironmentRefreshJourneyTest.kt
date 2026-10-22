package org.trustroots.android.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.EOFException
import java.io.IOException
import java.io.InputStream
import java.net.ServerSocket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.ui.contacts.ContactsScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ContactsEnvironmentRefreshJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun retainedContactsEntrySwitchesBackendAndRotatedCredentialsRejectLateOldResponse() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val oldBackend = BlockingOldBackend()
        val currentBackend = LocalTransportFixture { request ->
            when {
                request.path == "/api/users/steady-heron" -> LocalTransportFixture.Response(
                    """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                request.path == "/api/contacts/member-self" && request.cookie == "connect.sid=rotated-fictional" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"contact-rotated","user":{"_id":"member-rotated","username":"rotated-owl","displayName":"Rotated Owl"}}]""",
                    )
                request.path == "/api/contacts/member-self" -> LocalTransportFixture.Response(
                    """[{"_id":"contact-backend","user":{"_id":"member-backend","username":"backend-fox","displayName":"Backend Fox"}}]""",
                )
                else -> LocalTransportFixture.Response("[]")
            }
        }
        val cache = SecureResponseCache(context)
        cache.clear(oldBackend.baseURL, "steady-heron")
        cache.clear(currentBackend.baseURL, "steady-heron")
        val apiBaseURL = mutableStateOf(oldBackend.baseURL)
        val session = mutableStateOf(session("connect.sid=old-fictional"))
        val invalidations = AtomicInteger()

        try {
            compose.setContent {
                TrustrootsTheme {
                    ContactsScreen(
                        api = MobileApiClient(apiBaseURL.value),
                        session = session.value,
                        onSessionInvalidated = { invalidations.incrementAndGet() },
                        onBack = {},
                        onOpenProfile = {},
                    )
                }
            }
            assertTrue(
                "The original Contacts load should reach its delayed request",
                oldBackend.contactsRequested.await(10, TimeUnit.SECONDS),
            )

            compose.runOnIdle { apiBaseURL.value = currentBackend.baseURL }
            waitForText("Backend Fox")

            compose.runOnIdle { session.value = session("connect.sid=rotated-fictional") }
            waitForText("Rotated Owl")
            assertTrue(currentBackend.requests.any {
                it.path == "/api/contacts/member-self" && it.cookie == "connect.sid=rotated-fictional"
            })

            oldBackend.releaseResponse.countDown()
            assertTrue(
                "The superseded response should finish before checking retained state",
                oldBackend.contactsResponseFinished.await(10, TimeUnit.SECONDS),
            )
            compose.waitForIdle()

            compose.onNodeWithText("Rotated Owl").assertIsDisplayed()
            assertEquals(0, invalidations.get())
            assertTrue(compose.onAllNodesWithText("Backend Fox").fetchSemanticsNodes().isEmpty())
        } finally {
            oldBackend.close()
            currentBackend.close()
            cache.clear(oldBackend.baseURL, "steady-heron")
            cache.clear(currentBackend.baseURL, "steady-heron")
        }
    }

    private fun session(cookie: String) = MemberSession(
        cookie,
        MobileMember("steady-heron", "Steady Heron"),
    )

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText(text).assertIsDisplayed()
    }

    private class BlockingOldBackend : Closeable {
        private val server = ServerSocket(0).apply { soTimeout = 250 }
        val baseURL = "http://127.0.0.1:${server.localPort}"
        val contactsRequested = CountDownLatch(1)
        val releaseResponse = CountDownLatch(1)
        val contactsResponseFinished = CountDownLatch(1)
        private val responder = thread(isDaemon = true, name = "contacts-old-backend") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                var isContactsResponse = false
                try {
                    socket.use { connection ->
                        val input = connection.getInputStream()
                        val request = readLine(input) ?: throw EOFException("Missing request line")
                        while (!readLine(input).isNullOrEmpty()) Unit
                        val path = request.substringAfter(' ').substringBefore(' ')
                        val (status, body) = when (path) {
                            "/api/users/steady-heron" -> 200 to
                                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}"""
                            "/api/contacts/member-self" -> {
                                isContactsResponse = true
                                contactsRequested.countDown()
                                releaseResponse.await(10, TimeUnit.SECONDS)
                                401 to """{"message":"Fictional stale session response."}"""
                            }
                            else -> 404 to "{}"
                        }
                        val bytes = body.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write("HTTP/1.1 $status Fixture\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(Charsets.US_ASCII))
                            write(bytes)
                            flush()
                        }
                        if (isContactsResponse) {
                            connection.soTimeout = 5_000
                            try {
                                input.read()
                            } catch (_: SocketTimeoutException) {
                                // A disconnected client is expected after the delayed reply is consumed.
                            }
                        }
                    }
                } catch (_: IOException) {
                    // A cancelled HTTP request may close the client socket before this late reply.
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                } finally {
                    if (isContactsResponse) contactsResponseFinished.countDown()
                }
            }
        }

        override fun close() {
            releaseResponse.countDown()
            server.close()
            responder.join(2_000)
            check(!responder.isAlive) { "The delayed Contacts backend should stop after close" }
        }

        private fun readLine(input: InputStream): String? {
            val bytes = ByteArrayOutputStream()
            while (true) {
                val value = input.read()
                if (value < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
                if (value == '\n'.code) return bytes.toString(Charsets.US_ASCII.name()).removeSuffix("\r")
                bytes.write(value)
            }
        }
    }
}
