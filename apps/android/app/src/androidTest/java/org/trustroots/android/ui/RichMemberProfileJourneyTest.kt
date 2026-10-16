package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class RichMemberProfileJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-profile-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @After fun closeFixture() {
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        assertFalse("The local profile responder should stop after server shutdown", responder?.isAlive == true)
    }

    @Test fun displaysLanguagesCirclePlaceholderAndSingleGuestHostingDetails() {
        startResponder(ROOT_MAYBE_OFFER)
        showProfile("quiet-fox")

        waitForText("Quiet Fox")
        compose.onNodeWithTag("profileSection-about").performClick()
        compose.onNodeWithText("Languages: English, Portuguese").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Circles").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Silver Coast Circle").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Maybe hosting").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("A quiet place for one traveller.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Space for 1 guest").performScrollTo().assertIsDisplayed()

        compose.waitUntil(10_000) {
            requests.any { it.startsWith("GET /api/users/member-main/avatar?size=512 ") } &&
                requests.any { it.startsWith("GET /uploads-circle/silver-coast/120x120.jpg ") }
        }
        compose.onNodeWithText("S").performScrollTo().assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/offers-by/member-main?types=host ") })
    }

    @Test fun showsNoHostingNoteAndReferenceResponseThenOpensHostWithMultiplePlaces() {
        startResponder(ROOT_NO_OFFER)
        showProfile("quiet-fox")

        waitForText("Quiet Fox")
        compose.onNodeWithTag("profileSection-about").performClick()
        waitForText("Not hosting currently")
        compose.onNodeWithText("A busy season, but happy to share local tips.").performScrollTo().assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Space for up to 4 guests").fetchSemanticsNodes().isEmpty())

        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithText("A thoughtful visit with kind company.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Response: We would happily welcome them again.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Reference Author").performScrollTo().performClick()

        waitForText("Space for up to 4 guests")
        compose.onNodeWithText("Hosting travellers").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("A fictional home for several travellers.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()

        compose.onNodeWithTag("profileSection-experiences").assertIsDisplayed()
        compose.onNodeWithText("Response: We would happily welcome them again.").performScrollTo().assertIsDisplayed()
        assertTrue(requests.any { it.startsWith("GET /api/offers-by/member-main?types=host ") })
        assertTrue(requests.any { it.startsWith("GET /api/offers-by/member-related?types=host ") })
    }

    private fun showProfile(username: String) {
        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = session,
                username = username,
                onSessionInvalidated = {},
                onBack = {},
            )
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startResponder(rootOffer: String) {
        responder = thread(isDaemon = true, name = "rich-member-profile-local-api") {
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
                    socket.soTimeout = 2_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        requests += request
                        while (!input.readLine().isNullOrEmpty()) Unit
                        val (status, body) = fixtureResponse(request, rootOffer)
                        val bytes = body.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 $status\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw IOException("Local profile fixture could not complete a request", error)
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun fixtureResponse(request: String, rootOffer: String): Pair<String, String> = when {
        request.startsWith("GET /api/users/quiet-fox ") -> "200 OK" to ROOT_PROFILE
        request.startsWith("GET /api/users/reference-author ") -> "200 OK" to RELATED_PROFILE
        request.startsWith("GET /api/offers-by/member-main?types=host ") -> "200 OK" to rootOffer
        request.startsWith("GET /api/offers-by/member-related?types=host ") -> "200 OK" to RELATED_OFFER
        request.startsWith("GET /api/contacts/") -> "200 OK" to "[]"
        request.startsWith("GET /api/experiences?userTo=member-main ") -> "200 OK" to ROOT_REFERENCES
        request.startsWith("GET /api/experiences?") -> "200 OK" to "[]"
        request.startsWith("GET /api/contact-by/") -> "404 Not Found" to "{}"
        request.contains("/avatar?") || request.startsWith("GET /uploads-circle/") -> "404 Not Found" to ""
        else -> "404 Not Found" to "{}"
    }

    private companion object {
        const val ROOT_PROFILE = """{"_id":"member-main","username":"quiet-fox","displayName":"Quiet Fox","description":"<p>Travelling through <strong>fictional</strong> places.</p>","languages":["eng","por"],"member":[{"tribe":{"_id":"circle-silver","slug":"silver-coast","label":"Silver Coast Circle","count":8,"image":true}}]}"""
        const val RELATED_PROFILE = """{"_id":"member-related","username":"reference-author","displayName":"Reference Author"}"""
        const val ROOT_MAYBE_OFFER = """[{"_id":"offer-main","status":"maybe","description":"A quiet place for one traveller.","maxGuests":1}]"""
        const val ROOT_NO_OFFER = """[{"_id":"offer-main","status":"no","description":"Private offer details should not appear.","noOfferDescription":"A busy season, but happy to share local tips.","maxGuests":4}]"""
        const val RELATED_OFFER = """[{"_id":"offer-related","status":"yes","description":"A fictional home for several travellers.","maxGuests":4}]"""
        const val ROOT_REFERENCES = """[{"_id":"experience-one","userFrom":{"_id":"member-related","username":"reference-author","displayName":"Reference Author"},"feedbackPublic":"A thoughtful visit with kind company.","recommend":"yes","response":{"feedbackPublic":"We would happily welcome them again."}}]"""
    }
}
