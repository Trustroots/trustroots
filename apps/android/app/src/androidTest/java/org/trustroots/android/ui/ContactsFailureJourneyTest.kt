package org.trustroots.android.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
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
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.contacts.ContactsScreen

@RunWith(AndroidJUnit4::class)
class ContactsFailureJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0).apply { soTimeout = 300 }
    private val requests = CopyOnWriteArrayList<String>()
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        activeSocket?.close()
        responder?.join(1_500)
        assertTrue("The local contacts responder should stop after server shutdown", responder?.isAlive != true)
    }

    @Test fun profileWithoutMemberIdShowsErrorAndDoesNotRequestContacts() {
        startResponder { request ->
            if (request.startsWith("GET /api/users/quiet-fox ")) {
                FixtureResponse("200 OK", """{"username":"quiet-fox","displayName":"Quiet Fox"}""")
            } else {
                FixtureResponse("404 Not Found", "{}")
            }
        }
        compose.setContent {
            TrustrootsTheme {
                ContactsScreen(api(), session("quiet-fox"), onSessionInvalidated = {}, onBack = {}, onOpenProfile = {})
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Could not load contacts.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Could not load contacts.").assertIsDisplayed()
        assertEquals(listOf("GET /api/users/quiet-fox HTTP/1.1"), requests.toList())
    }

    @Test fun profileAndContactsServiceFailuresShowTheirErrorsWithoutSuccessContent() {
        startResponder { request ->
            when {
                request.startsWith("GET /api/users/quiet-fox ") -> FixtureResponse(
                    "503 Service Unavailable",
                    """{"message":"Fictional profile service is unavailable."}""",
                )
                request.startsWith("GET /api/users/amber-owl ") -> FixtureResponse(
                    "200 OK",
                    """{"_id":"member-amber","username":"amber-owl","displayName":"Amber Owl"}""",
                )
                request.startsWith("GET /api/contacts/member-amber ") -> FixtureResponse(
                    "503 Service Unavailable",
                    """{"message":"Fictional contacts service is unavailable."}""",
                )
                else -> FixtureResponse("404 Not Found", "{}")
            }
        }
        val activeSession = mutableStateOf(session("quiet-fox"))
        compose.setContent {
            TrustrootsTheme {
                ContactsScreen(api(), activeSession.value, onSessionInvalidated = {}, onBack = {}, onOpenProfile = {})
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional profile service is unavailable.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional profile service is unavailable.").assertIsDisplayed()
        assertTrue(requests.none { it.startsWith("GET /api/contacts/") })
        assertSuccessContentAbsent()

        compose.runOnIdle { activeSession.value = session("amber-owl") }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional contacts service is unavailable.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional contacts service is unavailable.").assertIsDisplayed()
        assertTrue(requests.any { it == "GET /api/contacts/member-amber HTTP/1.1" })
        assertSuccessContentAbsent()
    }

    @Test fun profileAndContactsAuthenticationFailuresInvalidateSessionWithoutSuccessContent() {
        startResponder { request ->
            when {
                request.startsWith("GET /api/users/quiet-fox ") -> FixtureResponse(
                    "401 Unauthorized",
                    """{"message":"Please sign in again."}""",
                )
                request.startsWith("GET /api/users/amber-owl ") -> FixtureResponse(
                    "200 OK",
                    """{"_id":"member-amber","username":"amber-owl","displayName":"Amber Owl"}""",
                )
                request.startsWith("GET /api/contacts/member-amber ") -> FixtureResponse(
                    "401 Unauthorized",
                    """{"message":"Please sign in again."}""",
                )
                else -> FixtureResponse("404 Not Found", "{}")
            }
        }
        val activeSession = mutableStateOf(session("quiet-fox"))
        val invalidations = AtomicInteger()
        compose.setContent {
            TrustrootsTheme {
                ContactsScreen(
                    api(),
                    activeSession.value,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.waitUntil(10_000) { invalidations.get() == 1 }
        assertTrue(requests.any { it == "GET /api/users/quiet-fox HTTP/1.1" })
        assertSuccessContentAbsent()

        compose.runOnIdle { activeSession.value = session("amber-owl") }
        compose.waitUntil(10_000) { invalidations.get() == 2 }
        compose.waitUntil(10_000) {
            requests.any { it == "GET /api/contacts/member-amber HTTP/1.1" }
        }
        assertSuccessContentAbsent()
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun session(username: String) =
        MemberSession("connect.sid=fictional-session", MobileMember(username, "${username.replaceFirstChar { it.uppercase() }} Member"))

    private fun assertSuccessContentAbsent() {
        assertTrue(
            compose.onAllNodesWithText("People you connect with on Trustroots will appear here.")
                .fetchSemanticsNodes().isEmpty(),
        )
        assertTrue(compose.onAllNodesWithText("Fictional contact member").fetchSemanticsNodes().isEmpty())
    }

    private fun startResponder(responseFor: (String) -> FixtureResponse) {
        responder = thread(isDaemon = true, name = "contacts-local-api") {
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
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) throw EOFException("Request ended before its declared body length")
                            offset += count
                        }
                        requests += request
                        val response = responseFor(request)
                        val bytes = response.body.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 ${response.status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
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

    private data class FixtureResponse(val status: String, val body: String)
}
