package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MemberSearchJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private var fixture: LocalTransportFixture? = null

    @After fun closeServer() {
        server.close()
        fixture?.close()
        fixture = null
    }

    @Test fun searchesAndOpensMemberProfile() {
        val responder = thread(isDaemon = true) {
            repeat(16) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
                        request.contains("/api/users?") -> """[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}]"""
                        request.contains("/api/offers-by/") -> """[{"status":"yes","description":"<p>Spare <strong>room</strong></p>","maxGuests":2}]"""
                        request.contains("/api/contact-by/") -> null
                        request.contains("/api/contacts/") -> """[{"_id":"contact-one","user":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"}}]"""
                        request.contains("/api/experiences?") -> """[{"_id":"reference-one","userFrom":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"},"feedbackPublic":"A thoughtful guest","recommend":"yes"}]"""
                        else -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Travelling slowly","description":"<p>Hosting <strong>travellers</strong></p>","languages":["eng","por"]}"""
                    }
                    val bytes = if (request.contains("/avatar?")) {
                        ByteArrayOutputStream().also { output ->
                            Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                                .compress(Bitmap.CompressFormat.PNG, 100, output)
                        }.toByteArray()
                    } else payload?.toByteArray() ?: ByteArray(0)
                    val status = if (payload == null && !request.contains("/avatar?")) {
                        "HTTP/1.1 404 Not Found"
                    } else {
                        "HTTP/1.1 200 OK"
                    }
                    socket.getOutputStream().write(
                        "$status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                SearchHubScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    initialTab = 1,
                )
            }
        }
        compose.onNodeWithText("Name or username").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_member_search")
        compose.onNodeWithContentDescription("Search mode").assertIsDisplayed()
        compose.onNodeWithText("Name or username").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Fox").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Travelling slowly").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Travelling slowly").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Members").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Hosts map").fetchSemanticsNodes().isEmpty())
        val profileHero = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val screen = compose.onRoot().fetchSemanticsNode().boundsInRoot
        assertEquals(screen.left, profileHero.left, 1f)
        assertEquals(screen.right, profileHero.right, 1f)
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Quiet Fox image").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Quiet Fox image").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertIsDisplayed()
        compose.onNodeWithText("Share your experience").assertIsDisplayed()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Add contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Add contact").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("A thoughtful guest").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithText("Languages: English, Portuguese").performScrollTo().assertIsDisplayed()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Spare room").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Spare room").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileSection-contacts").performScrollTo().performClick()
        compose.onNodeWithTag("profileContact-contact-one").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profilePager").performTouchInput { swipeLeft() }
        compose.onNodeWithText("A thoughtful guest").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Search mode").assertIsDisplayed()
        responder.join(1_000)
    }

    @Test fun requiresThreeCharactersAndShowsEmptySearchResults() {
        val requestCount = AtomicInteger()
        val requestedPath = AtomicReference("")
        val responder = thread(isDaemon = true) {
            val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
            connection.use { socket ->
                val input = socket.getInputStream().bufferedReader()
                requestedPath.set(input.readLine().orEmpty())
                while (!input.readLine().isNullOrEmpty()) Unit
                requestCount.incrementAndGet()
                val bytes = "[]".toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                MemberSearchScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }
        compose.onNodeWithTag("memberSearchField").performTextInput("ab")
        compose.onNodeWithText("Enter at least 3 characters.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Search members").assertIsNotEnabled()
        compose.onNodeWithTag("memberSearchField").performImeAction()
        compose.waitForIdle()
        assertEquals(0, requestCount.get())
        compose.onNodeWithText("Enter at least 3 characters.").assertIsDisplayed()

        compose.onNodeWithTag("memberSearchField").performTextReplacement("  fox  ")
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("No members found. Try another name or username.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(1, requestCount.get())
        assertTrue(requestedPath.get().contains("/api/users?search=fox&limit=50"))
        responder.join(1_000)
    }

    @Test fun retriesMemberSearchAfterServerError() {
        val requestCount = AtomicInteger()
        val responder = thread(isDaemon = true) {
            repeat(2) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val attempt = requestCount.incrementAndGet()
                    val status = if (attempt == 1) "HTTP/1.1 503 Service Unavailable" else "HTTP/1.1 200 OK"
                    val payload = if (attempt == 1) {
                        """{"message":"Search temporarily unavailable."}"""
                    } else {
                        """[{"username":"quiet-fox","displayName":"Quiet Fox"}]"""
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "$status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                MemberSearchScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }
        compose.onNodeWithText("Name or username").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Search temporarily unavailable.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(2, requestCount.get())
        assertTrue(compose.onAllNodesWithText("Search temporarily unavailable.").fetchSemanticsNodes().isEmpty())
        responder.join(1_000)
    }

    @Test fun submitsMemberSearchFromTheKeyboardSearchAction() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/users?") ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-member","username":"quiet-fox","displayName":"Quiet Fox","locationLiving":"Fictional Harbour","locationFrom":"Fictional Valley"}]""",
                    )
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                CompositionLocalProvider(LocalSoftwareKeyboardController provides null) {
                    MemberSearchScreen(
                        api = MobileApiClient(local.baseURL),
                        session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                    )
                }
            }
        }

        compose.onNodeWithTag("memberSearchField").performTextInput("quiet fox")
        compose.onNodeWithTag("memberSearchField").performImeAction()
        compose.waitUntil(10_000) {
            local.requests.any { it.path.startsWith("/api/users?") } &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Fictional Harbour").assertIsDisplayed()
        compose.onNodeWithText("From Fictional Valley").assertDoesNotExist()
        assertTrue(local.requests.any {
            it.method == "GET" && it.path == "/api/users?search=quiet+fox&limit=50"
        })
    }

    @Test fun ignoresASecondKeyboardSearchWhileTheFirstRequestIsLoading() {
        val releaseSearchResponse = CountDownLatch(1)
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/users?") -> {
                    check(releaseSearchResponse.await(10, TimeUnit.SECONDS)) {
                        "The test did not release the pending search response"
                    }
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-member","username":"quiet-fox","displayName":"Quiet Fox"}]""",
                    )
                }
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        try {
            compose.setContent {
                NativeTestAppFrame(Destination.Search) {
                    MemberSearchScreen(
                        api = MobileApiClient(local.baseURL),
                        session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                    )
                }
            }
            compose.onNodeWithTag("memberSearchField").performTextInput("quiet fox")
            compose.onNodeWithTag("memberSearchField").performImeAction()
            compose.waitUntil(10_000) { local.requests.any { it.path.startsWith("/api/users?") } }

            val searchField = compose.onNodeWithTag("memberSearchField")
            searchField.assertIsEnabled().performClick().performImeAction()
            assertEquals(1, local.requests.count { it.path.startsWith("/api/users?") })
        } finally {
            releaseSearchResponse.countDown()
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(1, local.requests.count { it.path.startsWith("/api/users?") })
    }
}
