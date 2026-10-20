package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.roundToInt
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertTrue
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

/** Checks that Circles titles collapse while scrollable content remains reachable. */
@RunWith(AndroidJUnit4::class)
class CirclesCollapsingHeaderJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val session = MemberSession(
        "connect.sid=fictional-circle-header-session",
        MobileMember("steady-heron", "Steady Heron"),
    )

    @Test fun overviewHeaderCollapsesDuringTouchScrolling() {
        val circles = (1..30).joinToString(",", "[", "]") { index ->
            """{"_id":"circle-$index","slug":"circle-$index","label":"Fictional Circle ${index.toString().padStart(2, '0')}","count":1,"image":false}"""
        }
        LocalTransportFixture { request ->
            LocalTransportFixture.Response(if (request.path.startsWith("/api/tribes")) circles else "[]")
        }.use { fixture ->
            compose.setContent {
                NativeTestAppFrame(Destination.Circles) {
                    CirclesScreen(MobileApiClient(fixture.baseURL), session, {})
                }
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Fictional Circle 01").fetchSemanticsNodes().isNotEmpty()
            }

            captureUsabilityScreenshot(compose, "android_circle_header_overview_before_scroll")
            val titleBefore = compose.onNodeWithText("Discover circles").getUnclippedBoundsInRoot()

            repeat(2) {
                compose.onNodeWithTag("circlesList").performTouchInput {
                    swipeUp(startY = height * 0.8f, endY = height * 0.2f)
                }
            }
            captureUsabilityScreenshot(compose, "android_circle_header_overview_after_scroll")
            val titleAfter = compose.onNodeWithText("Discover circles").getUnclippedBoundsInRoot()
            val listAfter = compose.onNodeWithTag("circlesList").fetchSemanticsNode()
            val scrollPosition = listAfter.config[SemanticsProperties.VerticalScrollAxisRange].value()

            // The expanded title settles into the compact Material title row as content scrolls.
            compose.onNodeWithText("Discover circles").assertIsDisplayed()
            assertTrue(titleAfter.top < titleBefore.top)
            assertTrue((titleAfter.bottom - titleAfter.top) < (titleBefore.bottom - titleBefore.top))
            assertTrue("The overview list must have scrolled", scrollPosition > 0f)
            compose.onNodeWithText("Fictional Circle 01").assertDoesNotExist()
        }
    }

    @Test fun detailHeaderAndBackRemainAfterArtworkScrollsAway() {
        val description = "<p>${"Fictional circle detail text for scrolling. ".repeat(36)}</p>"
        val circle = """[{"_id":"circle-one","slug":"fictional","label":"Fictional Circle","count":4,"image":false,"description":"$description"}]"""
        LocalTransportFixture { request ->
            LocalTransportFixture.Response(if (request.path.startsWith("/api/tribes")) circle else "[]")
        }.use { fixture ->
            compose.setContent {
                NativeTestAppFrame(Destination.Circles) {
                    CirclesScreen(MobileApiClient(fixture.baseURL), session, {})
                }
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Fictional Circle").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Fictional Circle").performClick()
            compose.onNodeWithTag("circleHero").assertIsDisplayed()
            captureUsabilityScreenshot(compose, "android_circle_header_detail_before_scroll")
            val root = compose.onRoot().getUnclippedBoundsInRoot()
            val titleBefore = compose.onNodeWithText("Fictional Circle").getUnclippedBoundsInRoot()
            val backBefore = compose.onNodeWithContentDescription("Back").getUnclippedBoundsInRoot()

            repeat(5) {
                if (compose.onAllNodesWithTag("circleHero").fetchSemanticsNodes().isNotEmpty()) {
                    compose.onNodeWithTag("circlesList").performTouchInput {
                        swipeUp(startY = height * 0.8f, endY = height * 0.2f)
                    }
                }
            }
            captureUsabilityScreenshot(compose, "android_circle_header_detail_after_scroll")
            val titleAfter = compose.onNodeWithText("Fictional Circle").getUnclippedBoundsInRoot()
            val backAfter = compose.onNodeWithContentDescription("Back").getUnclippedBoundsInRoot()

            // The artwork is disposed after scrolling while the compact title and Back remain.
            compose.onNodeWithTag("circleHero").assertDoesNotExist()
            assertTrue(backBefore.top >= root.top)
            assertTrue(backAfter.top >= root.top)
            assertTrue(backAfter.bottom <= root.bottom)
            assertTrue(kotlin.math.abs((backBefore.top - backAfter.top).value) < 1f)
            compose.onNodeWithText("Fictional Circle").assertIsDisplayed()
            assertTrue(titleAfter.top < titleBefore.top)
            assertTrue((titleAfter.bottom - titleAfter.top) < (titleBefore.bottom - titleBefore.top))
        }
    }

    @Test fun darkRtlDetailKeepsLongTitleAndBackInsideProvidedInsets() {
        val longLabel = "A Fictional Circle for Quiet Harbour Journeys Across the Northern Coast"
        val longDescription = "<p>${"Quiet <b>harbour</b> routes for travellers. ".repeat(24)}</p>"
        val circles = """[
            {"_id":"circle-harbour","slug":"harbour","label":"$longLabel","count":3,"image":false,"description":"$longDescription"},
            {"_id":"circle-forest","slug":"forest","label":"Fictional Forest Circle","count":1,"image":false}
        ]"""
        val baseContext = compose.activity
        val darkConfiguration = Configuration(baseContext.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
        }
        val darkContext = baseContext.createConfigurationContext(darkConfiguration)
        val insets = PaddingValues(start = 24.dp, top = 32.dp, end = 40.dp, bottom = 96.dp)
        val themeSurface = AtomicReference(Color.Unspecified)

        LocalTransportFixture { request ->
            LocalTransportFixture.Response(if (request.path.startsWith("/api/tribes")) circles else "[]")
        }.use { fixture ->
            compose.setContent {
                CompositionLocalProvider(
                    LocalContext provides darkContext,
                    LocalConfiguration provides darkConfiguration,
                    LocalLayoutDirection provides LayoutDirection.Rtl,
                ) {
                    NativeTestAppFrame(Destination.Circles) {
                        val surface = MaterialTheme.colorScheme.surface
                        SideEffect { themeSurface.set(surface) }
                        CirclesScreen(MobileApiClient(fixture.baseURL), session, {}, contentPadding = insets)
                    }
                }
            }
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText(longLabel).fetchSemanticsNodes().isNotEmpty()
            }
            assertTrue(themeSurface.get() == Color(darkContext.getColor(R.color.trustroots_surface)))

            compose.onNodeWithText("Filter circles").performTextReplacement(" HARBOUR ")
            hideTestKeyboard()
            compose.onNodeWithText(longLabel).assertIsDisplayed().performClick()
            compose.onNodeWithText("Fictional Forest Circle").assertDoesNotExist()
            compose.onNodeWithText(longLabel).assertIsDisplayed()

            val root = compose.onRoot().getUnclippedBoundsInRoot()
            val back = compose.onNodeWithContentDescription("Back")
            val backBounds = back.getUnclippedBoundsInRoot()
            back.assertIsDisplayed()
            val targetBounds = back.fetchSemanticsNode().boundsInRoot
            val minimumTargetPixels = with(compose.density) { 48.dp.roundToPx() }
            assertTrue("Back width must cover 48dp: $targetBounds", targetBounds.width.roundToInt() >= minimumTargetPixels)
            assertTrue("Back height must cover 48dp: $targetBounds", targetBounds.height.roundToInt() >= minimumTargetPixels)
            assertTrue(backBounds.top >= root.top + 32.dp)
            assertTrue(backBounds.right <= root.right - 24.dp)
            assertTrue(backBounds.bottom <= root.bottom)
            val title = compose.onNodeWithText(longLabel).getUnclippedBoundsInRoot()
            assertTrue((title.bottom - title.top) < 60.dp)
            captureUsabilityScreenshot(compose, "android_circle_header_dark_rtl_detail")

            repeat(4) {
                compose.onNodeWithTag("circlesList").performTouchInput {
                    swipeUp(startY = height * 0.8f, endY = height * 0.2f)
                }
            }
            compose.onNodeWithText("Join circle").assertIsDisplayed()
            val navigationTop = compose.onNodeWithTag("navigation-circles").getUnclippedBoundsInRoot().top
            val joinBounds = compose.onNodeWithText("Join circle").getUnclippedBoundsInRoot()
            assertTrue(joinBounds.bottom <= navigationTop - 96.dp)
            back.assertIsDisplayed()
        }
    }
}
