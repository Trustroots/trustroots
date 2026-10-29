package org.trustroots.android.ui

import androidx.compose.ui.test.hasText

import androidx.compose.ui.test.hasTestTag

import androidx.compose.ui.test.hasAnyAncestor

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.io.ByteArrayOutputStream
import java.net.ServerSocket
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
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.R
import org.trustroots.android.testing.pressBackFromNonActivityRoot
import org.trustroots.android.ui.membersearch.MemberSearchScreen
import org.trustroots.android.ui.membersearch.MemberSearchEvent
import org.trustroots.android.ui.membersearch.MemberSearchRepository
import org.trustroots.android.ui.membersearch.MemberSearchViewModel
import org.trustroots.android.ui.search.SearchHubScreen

@RunWith(AndroidJUnit4::class)
class MemberSearchJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun searchesAndOpensMemberProfile() {
        val responder = thread(isDaemon = true) {
            repeat(16) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
                        request.contains("/api/users?") -> """[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","locationFrom":"Imaginary Coast"}]"""
                        request.contains("/api/offers-by/") -> """[{"status":"yes","description":"<p>Spare <strong>room</strong></p>","maxGuests":2}]"""
                        request.contains("/api/contact-by/") -> null
                        request.contains("/api/contacts/") -> """[{"_id":"contact-one","user":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"}}]"""
                        request.contains("/api/experiences?") -> """[{"_id":"reference-one","userFrom":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"},"feedbackPublic":"A thoughtful guest","recommend":"yes"}]"""
                        else -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Travelling slowly","description":"<p>Hosting <strong>travellers</strong></p>","locationFrom":"Imaginary Coast","languages":["eng","por"]}"""
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
        compose.onNodeWithText("From Imaginary Coast").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Travelling slowly").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Travelling slowly").assertIsDisplayed()
        compose.onNode(hasText("From Imaginary Coast").and(hasAnyAncestor(hasTestTag("profilePager"))))
            .performScrollTo().assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Members").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Hosts map").fetchSemanticsNodes().isEmpty())
        val profileHero = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val screen = compose.onRoot().fetchSemanticsNode().boundsInRoot
        assertEquals(screen.left, profileHero.left, 1f)
        assertEquals(screen.right, profileHero.right, 1f)
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("View Quiet Fox profile photo").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("View Quiet Fox profile photo").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertIsDisplayed()
        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.onNodeWithText("Share your experience").assertIsDisplayed()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Add contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Add contact").assertIsDisplayed()
        pressBackFromNonActivityRoot(compose.activity)
        assertTrue(compose.onAllNodesWithText("A thoughtful guest").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithText("Languages: English, Portuguese").performScrollTo().assertIsDisplayed()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Spare room").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Spare room").performScrollTo().assertIsDisplayed()
        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-contacts").assertIsDisplayed().performClick()
        compose.onNodeWithTag("profileContact-contact-one").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profilePager").performTouchInput { swipeLeft() }
        compose.onNodeWithText("A thoughtful guest").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Search mode").assertIsDisplayed()
        responder.join(1_000)
    }

    @Test fun submitsSearchAndShowsResultsWithoutSoftwareKeyboardController() {
        val requestedPath = AtomicReference("")
        val responder = thread(isDaemon = true) {
            val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
            connection.use { socket ->
                val input = socket.getInputStream().bufferedReader()
                requestedPath.set(input.readLine().orEmpty())
                while (!input.readLine().isNullOrEmpty()) Unit
                val payload = """[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}]"""
                val bytes = payload.toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(bytes)
                socket.getOutputStream().flush()
            }
        }
        compose.setContent {
            CompositionLocalProvider(LocalSoftwareKeyboardController provides null) {
                NativeTestAppFrame(Destination.Search) {
                    MemberSearchScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = MemberSession("connect.sid=fictional-search-session", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                    )
                }
            }
        }

        compose.onNodeWithTag("memberSearchField").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(requestedPath.get().contains("/api/users?search=quiet+fox&limit=50"))
        responder.join(1_000)
    }

    private fun revealProfileTabsIfClipped() {
        val heroBottom = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot.bottom
        val tabs = compose.onAllNodesWithTag("profileSections").fetchSemanticsNodes().firstOrNull()
        if (tabs == null || tabs.boundsInRoot.bottom > heroBottom + 1f) {
            compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        }
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
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
                        """[{"username":"quiet-fox","displayName":"Quiet Fox","locationFrom":"Fictional Bay"}]"""
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
        compose.onNodeWithText(compose.activity.getString(R.string.member_location_from, "Fictional Bay")).assertIsDisplayed()
        assertEquals(2, requestCount.get())
        assertTrue(compose.onAllNodesWithText("Search temporarily unavailable.").fetchSemanticsNodes().isEmpty())
        responder.join(1_000)
    }

    @Test fun memberSearchScrollPositionFollowsRestoredAndResetViewModelOffset() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = MemberSearchRepository {
            Result.success((0 until 40).map { index ->
                MemberProfile(
                    id = "member-$index",
                    username = "quiet-fox-$index",
                    displayName = "Fictional Member $index",
                    tagline = null,
                    description = null,
                    location = null,
                    languages = emptyList(),
                )
            })
        }
        val viewModel = MemberSearchViewModel(repository, scope)
        try {
            compose.setContent {
                NativeTestAppFrame(Destination.Search) {
                    MemberSearchScreen(
                        api = MobileApiClient("https://api.example.test"),
                        session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                        viewModel = viewModel,
                    )
                }
            }
            compose.onNodeWithText("Find a member").assertIsDisplayed()
            compose.runOnUiThread {
                viewModel.onEvent(MemberSearchEvent.QueryChanged("quiet fox"))
                viewModel.onEvent(MemberSearchEvent.Submit)
            }
            compose.onNodeWithText("Fictional Member 0").assertIsDisplayed()
            compose.runOnUiThread { viewModel.onEvent(MemberSearchEvent.ResultsScrolled(500)) }
            compose.onNodeWithText("Fictional Member 0").assertIsNotDisplayed()

            compose.runOnUiThread { viewModel.onEvent(MemberSearchEvent.ResultsScrolled(0)) }
            compose.waitUntil(5_000) {
                compose.onAllNodesWithText("Fictional Member 0").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Fictional Member 0").assertIsDisplayed()
            compose.onNodeWithText("Fictional Member 39").assertIsNotDisplayed()
        } finally {
            scope.cancel()
        }
    }
}
