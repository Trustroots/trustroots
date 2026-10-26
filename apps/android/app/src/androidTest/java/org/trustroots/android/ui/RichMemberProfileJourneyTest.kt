package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.core.view.WindowCompat
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.testing.pressBackFromNonActivityRoot
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class RichMemberProfileJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-profile-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @Before fun useRealEdgeToEdgeWindowInsets() {
        compose.activityRule.scenario.onActivity { activity ->
            WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        }
    }

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
        val biographyTop = compose.onNodeWithText("Travelling through fictional places.").fetchSemanticsNode().boundsInRoot.top
        val hostingTop = compose.onNodeWithText("A quiet place for one traveller.").fetchSemanticsNode().boundsInRoot.top
        val circlesTop = compose.onNodeWithTag("profileCircle-silver-coast").fetchSemanticsNode().boundsInRoot.top
        assertTrue("Biography should precede hosting details", biographyTop < hostingTop)
        assertTrue("Hosting details should precede circles", hostingTop < circlesTop)

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

        revealProfileTabsIfClipped()
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
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles(circleCount = 30))
        showProfile("quiet-fox")

        waitForText("Quiet Fox")
        val actionsBounds = compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot
        val heroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val tabsBounds = compose.onNodeWithTag("profileSections").fetchSemanticsNode().boundsInRoot
        assertTrue("Profile tabs should sit over the artwork", tabsBounds.top >= heroBounds.top)
        assertTrue("Profile tabs should remain inside the artwork", tabsBounds.bottom <= heroBounds.bottom)
        captureUsabilityScreenshot(compose, "android_profile_shared_header")
        compose.onNodeWithText("Fictional Circle 14").assertIsNotDisplayed()
        val firstCircleTopBeforeScroll = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().positionInRoot.y
        scrollProfileSection()
        val collapsedHeroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        captureUsabilityScreenshot(compose, "android_member_profile_header_collapsed")
        assertCompactProfileHeader("Quiet Fox", ownProfile = false)

        assertEquals(actionsBounds, compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot)
        assertEquals(heroBounds.top, collapsedHeroBounds.top, 1f)
        assertTrue("Profile artwork should collapse as the section scrolls", collapsedHeroBounds.height < heroBounds.height)
        compose.onNodeWithTag("profileActions").assertIsDisplayed()
        compose.onNodeWithTag("profileHero").assertIsDisplayed()
        compose.onNodeWithTag("profileSections").assertDoesNotExist()

        // Clipped bounds stop at the viewport edge once Circle 1 scrolls out of view.
        // Its layout position continues to measure the section's actual movement.
        compose.onNodeWithText("Fictional Circle 30").assertIsNotDisplayed()
        val firstCircleTopAfterCollapse = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().positionInRoot.y
        scrollProfileSection()
        val firstCircleTopAfterContentSwipe = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().positionInRoot.y
        assertTrue("The profile section should keep scrolling after the header collapses", firstCircleTopAfterContentSwipe < firstCircleTopAfterCollapse)
        assertTrue("The first swipe should move the expanded content area", firstCircleTopAfterCollapse <= firstCircleTopBeforeScroll)
        compose.onNodeWithText("Fictional Circle 30").performScrollTo().assertIsDisplayed()

        compose.onNodeWithTag("profilePager").performTouchInput { swipeLeft() }
        compose.onNodeWithText("People you connect with on Trustroots will appear here.")
            .performScrollTo().assertIsDisplayed()
        assertEquals(1, compose.onAllNodesWithTag("profileHero").fetchSemanticsNodes().size)
        assertBoundsWithinOnePixel(
            collapsedHeroBounds,
            compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot,
            "The collapsed artwork frame should stay in place across pager pages",
        )
        compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        assertTrue(
            "A downward gesture should expand the artwork header",
            compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot.height > collapsedHeroBounds.height,
        )
        compose.onNodeWithTag("profileCompactTitle").assertIsNotDisplayed()
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
        compose.onNodeWithText("People you connect with on Trustroots will appear here.").assertIsDisplayed()
    }

    @Test fun capturesOwnProfileHeaderBaselineWhileItsSectionScrolls() {
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles())
        val ownSession = MemberSession(
            "connect.sid=fictional-own-profile-session",
            MobileMember("quiet-fox", "Quiet Fox"),
        )
        showProfile("quiet-fox", session = ownSession)
        waitForText("Quiet Fox")

        val actionsBounds = compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot
        val heroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        compose.onNodeWithTag("profileEditAction").assertIsDisplayed()
        compose.onNodeWithTag("profileCompactTitle").assertIsNotDisplayed()
        captureUsabilityScreenshot(compose, "android_own_profile_header_expanded_baseline")

        scrollProfileSection()
        compose.onNodeWithText("Fictional Circle 14").performScrollTo().assertIsDisplayed()

        assertEquals(actionsBounds, compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot)
        val collapsedHeroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        assertTrue(heroBounds.height > collapsedHeroBounds.height)
        assertCompactProfileHeader("Quiet Fox", ownProfile = true)
        captureUsabilityScreenshot(compose, "android_own_profile_header_scrolled_baseline")
        compose.onNodeWithTag("profileSections").assertDoesNotExist()
        compose.onNodeWithTag("profileEditAction").assertIsDisplayed()
        compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        assertTrue(compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot.height > collapsedHeroBounds.height)
        compose.onNodeWithTag("profileCompactTitle").assertIsNotDisplayed()
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
        compose.onNodeWithTag("profileSection-about").assertIsSelected()
        compose.onNodeWithText("Fictional Circle 1").assertIsDisplayed()
        compose.onNodeWithTag("profileEditAction").assertIsDisplayed()
    }

    @Test fun profileActionsStayOnArtworkWithAccessibleTargetsAfterTopInset() {
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles())
        showProfile(
            "quiet-fox",
            availableHeight = 360.dp,
            contentPadding = PaddingValues(top = 24.dp, bottom = 80.dp),
        )

        waitForText("Quiet Fox")
        val screenBounds = compose.onRoot().fetchSemanticsNode().boundsInRoot
        val heroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val actionScrim = compose.onNodeWithTag("profileActionsScrim").captureToImage().toPixelMap()
        val statusInsetBackground = actionScrim[1, 1]
        val statusIconContrast = 1.05f / (statusInsetBackground.luminance() + 0.05f)
        val actionsBounds = compose.onNodeWithTag("profileActions").fetchSemanticsNode().boundsInRoot
        val backBounds = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        val messageBounds = compose.onNodeWithTag("profileMessageAction").fetchSemanticsNode().boundsInRoot
        val menuBounds = compose.onNodeWithTag("profileActionsMenuButton").fetchSemanticsNode().boundsInRoot
        val avatarBounds = compose.onNodeWithTag("profileAvatar").fetchSemanticsNode().boundsInRoot

        assertEquals("Artwork should continue to the top behind the system inset", screenBounds.top, heroBounds.top, 1f)
        assertTrue("White status icons should contrast with the artwork-backed inset; got $statusIconContrast:1", statusIconContrast >= 3f)
        assertTrue("Actions should be drawn over the artwork", actionsBounds.top >= heroBounds.top && actionsBounds.bottom <= heroBounds.bottom)
        assertTrue("The primary action should remain within the screen width", messageBounds.right <= screenBounds.right)
        assertTrue("Back should begin below the 24dp top inset", backBounds.top >= with(compose.density) { 24.dp.toPx() })
        compose.onNodeWithTag("profileMessageAction").assertIsDisplayed()
        for ((label, bounds) in listOf(
            "Back" to backBounds,
            "Send a message" to messageBounds,
            "More actions" to menuBounds,
            "Avatar" to avatarBounds,
        )) {
            val widthDp = with(compose.density) { (bounds.right - bounds.left).toDp() }
            val heightDp = with(compose.density) { (bounds.bottom - bounds.top).toDp() }
            assertTrue("$label target should be at least 48dp wide; got $widthDp", widthDp >= 48.dp)
            assertTrue("$label target should be at least 48dp tall; got $heightDp", heightDp >= 48.dp)
        }

        compose.onNodeWithTag("profileActionsMenuButton").performClick()
        compose.onNodeWithText("Share your experience").assertIsDisplayed()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Add contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Add contact").assertIsDisplayed()
        pressBackFromNonActivityRoot(compose.activity)
        compose.onNodeWithTag("profilePager").assertIsDisplayed()
        compose.onNodeWithTag("profileActionsMenuButton").assertIsDisplayed()
    }

    @Test fun statusBarIconsStayWhiteOverArtworkAndRestoreLatestThemeOnExit() {
        startResponder(ROOT_MAYBE_OFFER)
        val activity = compose.activity
        val lightConfiguration = Configuration(activity.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_NO
        }
        val darkConfiguration = Configuration(activity.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
        }
        val lightContext = activity.createConfigurationContext(lightConfiguration)
        val darkContext = activity.createConfigurationContext(darkConfiguration)

        compose.setContent {
            var darkAppearance by remember { mutableStateOf(false) }
            var showingProfile by remember { mutableStateOf(true) }
            val currentContext = if (darkAppearance) darkContext else lightContext
            CompositionLocalProvider(
                LocalContext provides currentContext,
                LocalConfiguration provides currentContext.resources.configuration,
            ) {
                TrustrootsTheme {
                    Box(Modifier.fillMaxSize()) {
                        if (showingProfile) {
                            MemberProfileScreen(
                                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                                session = session,
                                username = "quiet-fox",
                                onSessionInvalidated = {},
                                onBack = { showingProfile = false },
                            )
                        } else {
                            TextButton(onClick = { showingProfile = true }) { Text("Open profile") }
                        }
                        TextButton(
                            onClick = { darkAppearance = !darkAppearance },
                            modifier = Modifier.align(Alignment.BottomStart),
                        ) {
                            Text(if (darkAppearance) "Use light appearance" else "Use dark appearance")
                        }
                    }
                }
            }
        }

        val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        waitForText("Quiet Fox")
        assertTrue("Artwork header should use white status icons", !controller.isAppearanceLightStatusBars)

        compose.onNodeWithText("Use dark appearance").performClick()
        compose.waitForIdle()
        assertTrue("Status icons should stay white while the artwork header is open", !controller.isAppearanceLightStatusBars)
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Open profile").assertIsDisplayed()
        assertTrue("Exiting the profile in dark appearance should restore white icons", !controller.isAppearanceLightStatusBars)

        compose.onNodeWithText("Open profile").performClick()
        waitForText("Quiet Fox")
        assertTrue("Artwork header should again use white status icons", !controller.isAppearanceLightStatusBars)
        compose.onNodeWithText("Use light appearance").performClick()
        compose.waitForIdle()
        assertTrue("Status icons should stay white when appearance changes back to light", !controller.isAppearanceLightStatusBars)
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Open profile").assertIsDisplayed()
        assertTrue("The latest light appearance should be restored", controller.isAppearanceLightStatusBars)
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
        compose.onNodeWithText("Fictional Circle 14").assertIsNotDisplayed()
        compose.onNodeWithText("Fictional Circle 1").performScrollTo().assertIsDisplayed()
        val firstCircleTopBeforeScroll = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        scrollProfileSection(bottomInset = 80.dp)
        val firstCircleTopAfterSwipe = compose.onNodeWithText("Fictional Circle 1").fetchSemanticsNode().boundsInRoot.top
        assertTrue("Compact section content should scroll", firstCircleTopAfterSwipe < firstCircleTopBeforeScroll)
        compose.onNodeWithText("Fictional Circle 14").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileSections").assertDoesNotExist()
        assertCompactProfileHeader("Quiet Fox", ownProfile = false)
        val insetPx = with(compose.density) { 24.dp.toPx() }
        val heroBounds = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        for (tag in listOf("profileMessageAction", "profileActionsMenuButton")) {
            val bounds = compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot
            assertTrue("$tag stays below the top inset", bounds.top >= insetPx)
            assertTrue(
                "$tag stays inside the compact artwork",
                bounds.top >= heroBounds.top && bounds.bottom <= heroBounds.bottom,
            )
        }
        val backBounds = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        assertTrue("Back stays below the top inset", backBounds.top >= insetPx)
        assertTrue(
            "Back stays inside the compact artwork",
            backBounds.top >= heroBounds.top && backBounds.bottom <= heroBounds.bottom,
        )
        captureUsabilityScreenshot(compose, "android_profile_compact_header")
        compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
    }

    @Test fun collapsedPagerCanChangePageThroughAccessibilityScrollAction() {
        startResponder(ROOT_MAYBE_OFFER, profileWithManyCircles())
        showProfile("quiet-fox")

        waitForText("Quiet Fox")
        scrollProfileSection()
        compose.onNodeWithText("Fictional Circle 14").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("profileSections").assertDoesNotExist()

        val pagerWidth = compose.onNodeWithTag("profilePager").fetchSemanticsNode().boundsInRoot.width
        compose.onNodeWithTag("profilePager").performSemanticsAction(SemanticsActions.ScrollBy) { scrollBy ->
            assertTrue("Accessibility scroll action should advance the pager", scrollBy(pagerWidth, 0f))
        }
        compose.waitForIdle()
        compose.onNodeWithTag("profileSections").assertDoesNotExist()

        compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
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

    private fun profileWithManyCircles(circleCount: Int = 14): String {
        val circles = (1..circleCount).joinToString(",") { index ->
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

    private fun revealProfileTabsIfClipped() {
        val heroBottom = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot.bottom
        val tabs = compose.onAllNodesWithTag("profileSections").fetchSemanticsNodes().firstOrNull()
        if (tabs == null || tabs.boundsInRoot.bottom > heroBottom + 1f) {
            compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        }
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
    }

    private fun showProfile(
        username: String,
        availableHeight: Dp? = null,
        contentPadding: PaddingValues? = null,
        session: MemberSession = this.session,
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
                        contentPadding = contentPadding ?: WindowInsets.safeDrawing.asPaddingValues(),
                    )
                }
                if (availableHeight == null) screen() else {
                    Box(Modifier.fillMaxWidth().requiredHeight(availableHeight)) { screen() }
                }
            }
        }
    }

    private fun assertCompactProfileHeader(title: String, ownProfile: Boolean) {
        val hero = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val actionScrim = compose.onNodeWithTag("profileActionsScrim").fetchSemanticsNode().boundsInRoot
        val titleBounds = compose.onNodeWithTag("profileCompactTitle").fetchSemanticsNode().boundsInRoot
        assertEquals("Collapsed header is one inset-aware action row", actionScrim.height, hero.height, with(compose.density) { 2.dp.toPx() })
        assertTrue("Compact title remains in the action row", titleBounds.top >= actionScrim.top && titleBounds.bottom <= actionScrim.bottom)
        compose.onNodeWithTag("profileSections").assertDoesNotExist()
        compose.onNodeWithTag("profileCompactTitle").assertIsDisplayed()
        compose.onNodeWithText(title).assertIsDisplayed()
        compose.onNodeWithTag("profileHero-identity").assertIsNotDisplayed()

        val actionTag = if (ownProfile) "profileEditAction" else "profileMessageAction"
        val action = compose.onNodeWithTag(actionTag).fetchSemanticsNode().boundsInRoot
        val back = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        for ((label, bounds) in listOf("Back" to back, "Primary action" to action)) {
            val width = with(compose.density) { (bounds.right - bounds.left).toDp() }
            val height = with(compose.density) { (bounds.bottom - bounds.top).toDp() }
            assertTrue("$label target should remain at least 48dp wide", width >= 48.dp)
            assertTrue("$label target should remain at least 48dp tall", height >= 48.dp)
            assertTrue("$label remains visible within the compact header", bounds.top >= hero.top && bounds.bottom <= hero.bottom)
        }
        if (!ownProfile) {
            val overflow = compose.onNodeWithTag("profileActionsMenuButton").fetchSemanticsNode().boundsInRoot
            assertTrue("Overflow remains at least 48dp wide", with(compose.density) { (overflow.right - overflow.left).toDp() } >= 48.dp)
            assertTrue("Overflow remains at least 48dp tall", with(compose.density) { (overflow.bottom - overflow.top).toDp() } >= 48.dp)
        }
    }

    private fun assertBoundsWithinOnePixel(expected: androidx.compose.ui.geometry.Rect, actual: androidx.compose.ui.geometry.Rect, message: String) {
        for ((edge, expectedValue, actualValue) in listOf(
            Triple("left", expected.left, actual.left),
            Triple("top", expected.top, actual.top),
            Triple("right", expected.right, actual.right),
            Triple("bottom", expected.bottom, actual.bottom),
        )) {
            assertEquals("$message ($edge)", expectedValue, actualValue, 1f)
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
