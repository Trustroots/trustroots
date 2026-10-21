package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class MemberProfileStatesJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))

    @After fun closeServer() {
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
    }

    @Test fun showsObservableEmptyStatesForASparseProfile() {
        respondToProfileRequests(withLists = false)
        compose.setContent {
            MemberProfileScreen(
                api = api(),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        awaitProfileRequests()
        compose.onNodeWithText("No about text yet.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Not hosting currently").performScrollTo().assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Languages:").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Circles").fetchSemanticsNodes().isEmpty())

        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithText("No experiences shared yet.").performScrollTo().assertIsDisplayed()
        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-contacts").performClick()
        compose.onNodeWithText("People you connect with on Trustroots will appear here.")
            .performScrollTo().assertIsDisplayed()
    }

    @Test fun expandsRelatedListsAndReturnsToTheSameTabAndExpandedList() {
        respondToProfileRequests(withLists = true)
        compose.setContent {
            MemberProfileScreen(
                api = api(),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        awaitProfileRequests()
        compose.onNodeWithTag("profileSection-contacts").performClick()
        compose.onNodeWithText("More contacts (1)").performScrollTo().performClick()
        compose.onNodeWithText("Contact Seven").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Contact Seven").performClick()
        awaitRelatedProfile()
        compose.onNodeWithText("Related Traveller").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()

        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
        compose.onNodeWithText("Contact Seven").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Show fewer").performScrollTo().assertIsDisplayed()

        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithText("More experiences (1)").performScrollTo().performClick()
        compose.onNodeWithText("Reference Seven").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Reference Seven").performClick()
        awaitRelatedProfile()
        compose.onNodeWithText("Related Traveller").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()

        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-experiences").assertIsSelected()
        compose.onNodeWithText("Reference Seven").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Show fewer").performScrollTo().assertIsDisplayed()
    }

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun revealProfileTabsIfClipped() {
        val heroBottom = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot.bottom
        val tabs = compose.onAllNodesWithTag("profileSections").fetchSemanticsNodes().firstOrNull()
        if (tabs == null || tabs.boundsInRoot.bottom > heroBottom + 1f) {
            compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        }
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
    }

    private fun awaitProfileRequests() {
        val expected = listOf(
            "GET /api/users/quiet-fox ",
            "GET /api/offers-by/member-main?types=host ",
            "GET /api/contacts/member-main ",
            "GET /api/experiences?userTo=member-main ",
            "GET /api/contact-by/member-main ",
        )
        compose.waitUntil(10_000) { expected.all { prefix -> requests.any { it.startsWith(prefix) } } }
    }

    private fun awaitRelatedProfile() {
        compose.waitUntil(10_000) {
            requests.any { it.startsWith("GET /api/users/related-traveller ") } &&
                compose.onAllNodesWithText("Related Traveller").fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun respondToProfileRequests(withLists: Boolean) {
        val contacts = if (withLists) (1..7).joinToString(",") { index ->
            """{"_id":"contact-$index","user":{"username":"related-traveller","displayName":"Contact ${indexName(index)}"}}"""
        } else ""
        val references = if (withLists) (1..7).joinToString(",") { index ->
            """{"_id":"reference-$index","userFrom":{"username":"related-traveller","displayName":"Reference ${indexName(index)}"},"feedbackPublic":"Fictional feedback $index"}"""
        } else ""
        responder = thread(isDaemon = true, name = "member-profile-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (_: SocketException) {
                    if (server.isClosed) break else continue
                }
                activeSocket = socket
                try {
                    socket.soTimeout = 2_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        requests += request
                        while (!input.readLine().isNullOrEmpty()) Unit
                        val (status, body) = fixtureResponse(request, contacts, references)
                        val bytes = body.toByteArray()
                        connection.getOutputStream().apply {
                            write("HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                            write(bytes)
                            flush()
                        }
                    }
                } catch (_: IOException) {
                    if (!server.isClosed) throw IOException("Local profile fixture failed to handle a request")
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun fixtureResponse(request: String, contacts: String, references: String): Pair<String, String> = when {
        request.startsWith("GET /api/users/quiet-fox ") ->
            "200 OK" to """{"_id":"member-main","username":"quiet-fox","displayName":"Quiet Fox"}"""
        request.startsWith("GET /api/users/related-traveller ") ->
            "200 OK" to """{"_id":"member-related","username":"related-traveller","displayName":"Related Traveller"}"""
        request.startsWith("GET /api/offers-by/") -> "200 OK" to "[]"
        request.startsWith("GET /api/contacts/member-main ") -> "200 OK" to "[$contacts]"
        request.startsWith("GET /api/experiences?userTo=member-main ") -> "200 OK" to "[$references]"
        request.startsWith("GET /api/contact-by/") -> "404 Not Found" to "{}"
        request.startsWith("GET /api/contacts/") -> "200 OK" to "[]"
        request.startsWith("GET /api/experiences?") -> "200 OK" to "[]"
        request.contains("/avatar?") -> "404 Not Found" to ""
        else -> "404 Not Found" to "{}"
    }

    private fun indexName(index: Int) = when (index) {
        1 -> "One"
        2 -> "Two"
        3 -> "Three"
        4 -> "Four"
        5 -> "Five"
        6 -> "Six"
        else -> "Seven"
    }
}
