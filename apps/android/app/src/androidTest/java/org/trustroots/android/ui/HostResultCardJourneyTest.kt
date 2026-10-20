package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.hostmap.HostResultCard
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HostResultCardJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun displaysHostContextAndOpensProfileFromCard() {
        val opened = AtomicBoolean(false)
        val closed = AtomicBoolean(false)
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                HostResultCard(
                    offer = HostOffer("offer-one", "maybe", "A spare room for visiting travellers.", 2, MessageMember(null, "quiet-fox", "Quiet Fox")),
                    profile = MemberProfile(null, "quiet-fox", "Quiet Fox", "Travelling slowly", null, null, languages = emptyList(), circles = listOf(TrustrootsCircle("circle-one", "wanderers", "Wanderers", null, 12, false, null))),
                    sharedCircleIDs = setOf("circle-one"),
                    isMeet = false,
                    api = MobileApiClient("http://127.0.0.1:1"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    onClose = { closed.set(true) },
                    onOpenProfile = { opened.set(true) },
                )
            }
        }
        compose.onNodeWithText("@quiet-fox").assertIsDisplayed()
        compose.onNodeWithText("Maybe hosting").assertIsDisplayed()
        compose.onNodeWithText("Circles in common: Wanderers").assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_host_result")
        compose.onNodeWithContentDescription("Close host result").performClick()
        assertTrue(closed.get())
        org.junit.Assert.assertFalse(opened.get())
        compose.onNodeWithTag("hostResultCard").performClick()
        assertTrue(opened.get())
    }

    @Test fun keepsLongHostDetailsScrollableWithinSmallHeightAndCloseReachable() {
        val closed = AtomicBoolean(false)
        val description = (1..16).joinToString(" ") {
            "A quiet fictional room is available for visiting travellers."
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                HostResultCard(
                    offer = HostOffer("offer-two", "maybe", description, 2, MessageMember(null, "quiet-fox", "Quiet Fox")),
                    profile = MemberProfile(null, "quiet-fox", "Quiet Fox", null, null, null, languages = emptyList()),
                    sharedCircleIDs = emptySet(),
                    isMeet = false,
                    api = MobileApiClient("http://127.0.0.1:1"),
                    session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                    maxHeight = 180.dp,
                    onClose = { closed.set(true) },
                    onOpenProfile = {},
                )
            }
        }

        val cardHeightPx = compose.onNodeWithTag("hostResultCard")
            .fetchSemanticsNode()
            .boundsInRoot
            .height
        val maxHeightPx = with(compose.density) { 180.dp.roundToPx() }
        assertTrue("Card exceeded its rounded 180 dp pixel cap: $cardHeightPx px > $maxHeightPx px", cardHeightPx <= maxHeightPx)
        compose.onNodeWithText("Up to 2 guests", useUnmergedTree = true).performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Close host result", useUnmergedTree = true).performScrollTo().performClick()
        assertTrue(closed.get())
    }

    @Test fun keepsHostCardWhiteAndReadableInDarkAppearance() {
        val baseContext = compose.activity
        val darkConfiguration = Configuration(baseContext.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
        }
        val darkContext = baseContext.createConfigurationContext(darkConfiguration)
        val displayedOffer = mutableStateOf(
            HostOffer("offer-three", "yes", "A quiet fictional room.", 1, MessageMember(null, "quiet-fox", "Quiet Fox")),
        )
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides darkContext,
                LocalConfiguration provides darkContext.resources.configuration,
            ) {
                TrustrootsTheme {
                    HostResultCard(
                        offer = displayedOffer.value,
                        profile = MemberProfile(null, "quiet-fox", "Quiet Fox", "Travelling slowly", null, null, languages = emptyList()),
                        sharedCircleIDs = emptySet(),
                        isMeet = false,
                        api = MobileApiClient("http://127.0.0.1:1"),
                        session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                        onClose = {},
                        onOpenProfile = {},
                    )
                }
            }
        }

        compose.onNodeWithText("@quiet-fox").assertIsDisplayed()
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        val pixels = compose.onNodeWithTag("hostResultCard").captureToImage().toPixelMap()
        val inset = with(compose.density) { 8.dp.roundToPx() }
        assertEquals(Color.White, pixels[inset, pixels.height / 2])

        compose.runOnIdle {
            displayedOffer.value = displayedOffer.value.copy(user = MessageMember(null, null, "Quiet Fox"))
        }
        val disabledPixels = compose.onNodeWithTag("hostResultCard").captureToImage().toPixelMap()
        assertEquals(Color.White, disabledPixels[inset, disabledPixels.height / 2])
    }
}
