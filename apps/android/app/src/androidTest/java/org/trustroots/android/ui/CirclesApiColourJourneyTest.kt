package org.trustroots.android.ui

import android.graphics.Color as AndroidColor
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.common.ArtworkHero

@RunWith(AndroidJUnit4::class)
class CirclesApiColourJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun displaysValidApiHexColourInCircleHero() {
        val fixture = startCircleFixture("336699")
        showCircle(fixture)

        assertHeroTopPixelMatches(0xFF336699.toInt())
    }

    @Test fun invalidApiHexColourUsesCircleFallbackColour() {
        val fixture = startCircleFixture("zzzzzz")
        showCircle(fixture)

        assertHeroTopPixelMatches(0xFF12B591.toInt())
    }

    private fun startCircleFixture(color: String): LocalTransportFixture =
        LocalTransportFixture { request ->
            when (request.path) {
                "/api/tribes?limit=150" -> LocalTransportFixture.Response(
                    """[{"_id":"circle-harbour","slug":"harbour","label":"Fictional Harbour Circle","count":12,"created":"2025-01-01T00:00:00.000Z","modified":"2025-01-02T00:00:00.000Z","public":true,"image":false,"color":"$color"}]""",
                )
                "/api/users/memberships" -> LocalTransportFixture.Response("[]")
                else -> error("Unexpected circle fixture request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

    private fun showCircle(local: LocalTransportFixture) {
        compose.setContent {
            NativeTestAppFrame(Destination.Circles) {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession("connect.sid=fictional-circle-session", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                )
            }
        }

        waitForText("Fictional Harbour Circle")
        compose.onNodeWithText("Fictional Harbour Circle").performClick()
        compose.onNodeWithText("Fictional Harbour Circle").assertIsDisplayed()
        compose.onNodeWithText("12 members").assertIsDisplayed()
        compose.onNodeWithTag("circleHero").assertIsDisplayed()
    }

    private fun assertHeroTopPixelMatches(expected: Int) {
        val pixel = compose.onNodeWithTag("circleHero").captureToImage().toPixelMap()[2, 2]
        val shade = 0.8f // ArtworkHero's top overlay is black at 20% opacity.
        val tolerance = 3f / 255f
        assertEquals(AndroidColor.red(expected) / 255f * shade, pixel.red, tolerance)
        assertEquals(AndroidColor.green(expected) / 255f * shade, pixel.green, tolerance)
        assertEquals(AndroidColor.blue(expected) / 255f * shade, pixel.blue, tolerance)
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }
}
