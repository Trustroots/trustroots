package org.trustroots.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
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
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

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

    @Test fun compactProfileCaptionHasReadableContrastOnBrightArtwork() {
        compose.setContent {
            TrustrootsTheme {
                ArtworkHero(
                    url = null,
                    sessionCookie = null,
                    label = "Anonymous profile",
                    subtitle = "@fictional-member",
                    background = Color.White,
                    blurBackground = false,
                    testTag = "contrastHero",
                    heroHeight = 128.dp,
                    compact = true,
                )
            }
        }

        val pixels = compose.onNodeWithTag("contrastHero-identity").captureToImage().toPixelMap()
        val background = pixels[pixels.width - 2, pixels.height / 2]
        val contrastRatio = 1.05f / (background.luminance() + 0.05f)
        assertTrue(
            "Compact white caption should have 4.5:1 contrast on bright artwork; got $contrastRatio:1",
            contrastRatio >= 4.5f,
        )
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

    @Test fun keepsSharedProfileFrameVisibleWhileScrollingAndSwipingSections() {
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles())
        showProfile("quiet-fox")

        waitForText("Quiet Fox")
        val actionsBounds = compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot
        val heroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val tabsBounds = compose.onNodeWithTag("profileSections").fetchSemanticsNode().boundsInRoot
        assertTrue("Profile tabs should sit over the artwork", tabsBounds.top >= heroBounds.top)
        assertTrue("Profile tabs should remain inside the artwork", tabsBounds.bottom <= heroBounds.bottom)
        captureUsabilityScreenshot(compose, "android_profile_shared_header")
        compose.onNodeWithText("Fictional Circle 14").assertIsNotDisplayed()
        val firstCircleTopBeforeScroll = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        scrollProfileSection()
        val firstCircleTopAfterSwipe = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        assertTrue("The section should scroll independently", firstCircleTopAfterSwipe < firstCircleTopBeforeScroll)
        compose.onNodeWithText("Fictional Circle 14").performScrollTo().assertIsDisplayed()

        assertEquals(actionsBounds, compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot)
        assertEquals(heroBounds, compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot)
        assertEquals(tabsBounds, compose.onNodeWithTag("profileSections").fetchSemanticsNode().boundsInRoot)
        compose.onNodeWithTag("profileActions").assertIsDisplayed()
        compose.onNodeWithTag("profileHero").assertIsDisplayed()
        compose.onNodeWithTag("profileSections").assertIsDisplayed()

        compose.onNodeWithTag("profilePager").performTouchInput { swipeLeft() }
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
        compose.onNodeWithText("People you connect with on Trustroots will appear here.")
            .performScrollTo().assertIsDisplayed()
        assertEquals(1, compose.onAllNodesWithTag("profileHero").fetchSemanticsNodes().size)
        assertEquals(heroBounds, compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot)
        assertEquals(tabsBounds, compose.onNodeWithTag("profileSections").fetchSemanticsNode().boundsInRoot)
    }

    @Test fun compactProfileKeepsUsableScrollableSectionViewport() {
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles())
        showProfile(
            "quiet-fox",
            availableHeight = 360.dp,
            contentPadding = PaddingValues(top = 24.dp, bottom = 80.dp),
        )

        waitForText("Quiet Fox")
        val pagerHeight = compose.onNodeWithTag("profilePager").fetchSemanticsNode().boundsInRoot.height
        val pagerHeightDp = with(compose.density) { pagerHeight.toDp() }
        val sectionHeightAfterInset = pagerHeightDp - 80.dp
        assertTrue(
            "Compact profile should retain at least 96dp after bottom padding, got $sectionHeightAfterInset",
            sectionHeightAfterInset >= 96.dp,
        )
        captureUsabilityScreenshot(compose, "android_profile_compact_header")
        compose.onNodeWithText("Fictional Circle 14").assertIsNotDisplayed()
        compose.onNodeWithText("Fictional Circle 1").performScrollTo().assertIsDisplayed()
        val firstCircleTopBeforeScroll = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        scrollProfileSection(bottomInset = 80.dp)
        val firstCircleTopAfterSwipe = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        assertTrue("Compact section content should scroll", firstCircleTopAfterSwipe < firstCircleTopBeforeScroll)
        compose.onNodeWithText("Fictional Circle 14").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
    }

    @Test fun shorterCompactProfileKeepsSectionContentReachable() {
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles())
        showProfile(
            "quiet-fox",
            availableHeight = 320.dp,
            contentPadding = PaddingValues(top = 24.dp, bottom = 80.dp),
        )

        waitForText("Quiet Fox")
        val pagerHeight = compose.onNodeWithTag("profilePager").fetchSemanticsNode().boundsInRoot.height
        val pagerHeightDp = with(compose.density) { pagerHeight.toDp() }
        val sectionHeightAfterInset = pagerHeightDp - 80.dp
        assertTrue(
            "Short profile should retain at least 48dp after bottom padding, got $sectionHeightAfterInset",
            sectionHeightAfterInset >= 48.dp,
        )
        compose.onNodeWithText("Fictional Circle 14").assertIsNotDisplayed()
        compose.onNodeWithText("Fictional Circle 1").performScrollTo().assertIsDisplayed()
        val firstCircleTopBeforeScroll = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        scrollProfileSection(bottomInset = 80.dp)
        val firstCircleTopAfterSwipe = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        assertTrue("Short section content should still scroll", firstCircleTopAfterSwipe < firstCircleTopBeforeScroll)
        compose.onNodeWithText("Fictional Circle 14").performScrollTo().assertIsDisplayed()
    }

    private fun profileWithManyCircles(): String {
        val circles = (1..14).joinToString(",") { index ->
            """{"tribe":{"_id":"circle-$index","slug":"circle-$index","label":"Fictional Circle $index","count":1,"image":false}}"""
        }
        val existingMember = "\"member\":[{\"tribe\":{\"_id\":\"circle-silver\",\"slug\":\"silver-coast\",\"label\":\"Silver Coast Circle\",\"count\":8,\"image\":true}}]"
        return ROOT_PROFILE.replace(existingMember, "\"member\":[$circles]")
    }

    private fun scrollProfileSection(bottomInset: Dp = 0.dp) {
        val bottomInsetPx = with(compose.density) { bottomInset.toPx() }
        compose.onNodeWithTag("profilePager").performTouchInput {
            val contentHeight = height - bottomInsetPx
            swipeUp(startY = contentHeight * 0.8f, endY = contentHeight * 0.2f)
        }
    }

    private fun showProfile(
        username: String,
        availableHeight: Dp? = null,
        contentPadding: PaddingValues = PaddingValues.Zero,
    ) {
        compose.setContent {
            TrustrootsTheme {
                val screen: @Composable () -> Unit = {
                    MemberProfileScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = session,
                        username = username,
                        onSessionInvalidated = {},
                        onBack = {},
                        contentPadding = contentPadding,
                    )
                }
                if (availableHeight == null) screen() else {
                    Box(Modifier.fillMaxWidth().requiredHeight(availableHeight)) { screen() }
                }
            }
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun startResponder(rootOffer: String, rootProfile: String = ROOT_PROFILE) {
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
                        val (status, body) = fixtureResponse(request, rootOffer, rootProfile)
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

    private fun fixtureResponse(request: String, rootOffer: String, rootProfile: String): Pair<String, String> = when {
        request.startsWith("GET /api/users/quiet-fox ") -> "200 OK" to rootProfile
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
