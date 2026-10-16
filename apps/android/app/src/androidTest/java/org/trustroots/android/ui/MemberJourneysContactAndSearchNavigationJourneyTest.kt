package org.trustroots.android.ui

import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.activity.ComponentActivity
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MemberJourneysContactAndSearchNavigationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 250 }
    private val requests = CopyOnWriteArrayList<String>()
    private val responderFailure = AtomicReference<Throwable?>(null)
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null

    @After fun stopResponder() {
        runCatching { server.close() }
        runCatching { activeSocket?.close() }
        responder?.join(1_500)
        assertTrue("The local HTTP fixture should terminate", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("Local HTTP fixture failed", it) }
    }

    @Test fun contactWithoutUsernameIsVisibleButCannotOpenAProfile() {
        startResponder { path ->
            when {
                path == "/api/users/steady-heron" -> json(
                    "200 OK",
                    """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
                )
                path == "/api/contacts/member-self" -> json(
                    "200 OK",
                    """[{"_id":"contact-one","user":{"_id":"member-two","username":null,"displayName":"Unnamed Member"}}]""",
                )
                else -> json("404 Not Found", "{}")
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Menu) {
                ContactsScreen(
                    api = api(),
                    session = session(),
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Unnamed Member").fetchSemanticsNodes().isNotEmpty()
        }
        val contactName = compose.onNodeWithText("Unnamed Member")
        contactName.assertIsDisplayed().assertHasNoClickAction()
        assertTrue(requests.any { it == "GET /api/contacts/member-self HTTP/1.1" })
        assertTrue(requests.none { it == "GET /api/users/member-two HTTP/1.1" })
    }

    @Test fun systemBackClosesMemberProfileBeforeReturningFromSearchToMap() {
        startResponder { path ->
            when {
                path.startsWith("/api/offers?") -> json("200 OK", """{"features":[]}""")
                path.startsWith("/api/users?") -> json(
                    "200 OK",
                    """[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}]""",
                )
                path == "/api/users/quiet-fox" -> json(
                    "200 OK",
                    """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Travelling slowly"}""",
                )
                else -> json("200 OK", "[]")
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(api(), session(), onSessionInvalidated = {})
            }
        }

        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithText("Name or username").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Fox").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Travelling slowly").fetchSemanticsNodes().isNotEmpty()
        }

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Travelling slowly").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithContentDescription("Search mode").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithTag("placeSearchField").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Find a member").fetchSemanticsNodes().isEmpty())

        compose.runOnIdle { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithContentDescription("Search mode").assertIsDisplayed()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("placeSearchField").fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun session() = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))

    private data class FixtureResponse(val status: String, val body: String)

    private fun json(status: String, body: String) = FixtureResponse(status, body)

    private fun startResponder(response: (String) -> FixtureResponse) {
        responder = thread(isDaemon = true, name = "member-journeys-local-http") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (!server.isClosed) responderFailure.compareAndSet(null, error)
                    return@thread
                } catch (error: IOException) {
                    if (!server.isClosed) responderFailure.compareAndSet(null, error)
                    return@thread
                }
                activeSocket = socket
                try {
                    socket.use { client ->
                        client.soTimeout = 2_000
                        val reader = client.getInputStream().bufferedReader()
                        val request = reader.readLine().orEmpty()
                        while (!reader.readLine().isNullOrEmpty()) Unit
                        requests += request
                        val result = response(request.substringAfter(' ').substringBefore(' '))
                        val bytes = result.body.toByteArray(Charsets.UTF_8)
                        client.getOutputStream().apply {
                            write(
                                "HTTP/1.1 ${result.status}\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) responderFailure.compareAndSet(null, error)
                } catch (error: Throwable) {
                    responderFailure.compareAndSet(null, error)
                } finally {
                    activeSocket = null
                }
            }
        }
    }
}
