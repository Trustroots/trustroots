package org.trustroots.android.ui

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.startup.StartupTransition

@RunWith(AndroidJUnit4::class)
class StartupTransitionJourneyTest {
    @get:Rule val compose = createComposeRule(effectContext = object : MotionDurationScale {
        override val scaleFactor = 1f
    })

    @Test fun readyDestinationIsInteractiveWhileStartupFadesOut() {
        val starting = mutableStateOf(true)
        var clicked = false
        compose.mainClock.autoAdvance = false
        compose.setContent {
            StartupTransition(starting.value) {
                Button(onClick = { clicked = true }) { Text("Ready destination") }
            }
        }
        compose.onNodeWithText("Ready destination").assertDoesNotExist()
        compose.onNodeWithContentDescription("Trustroots").assertIsDisplayed()
        compose.runOnIdle { starting.value = false }
        compose.mainClock.advanceTimeByFrame()
        compose.onNodeWithText("Ready destination").assertIsDisplayed().performClick()
        assertTrue(clicked)
        compose.onNodeWithContentDescription("Trustroots").assertExists()
        compose.mainClock.advanceTimeBy(220)
        compose.waitForIdle()
        compose.onNodeWithContentDescription("Trustroots").assertDoesNotExist()
    }

    @Test fun completedRestorationDoesNotReplayStartup() {
        compose.setContent {
            StartupTransition(false) { Text("Ready destination") }
        }
        compose.onNodeWithText("Ready destination").assertIsDisplayed()
        compose.onNodeWithContentDescription("Trustroots").assertDoesNotExist()
    }
}

@RunWith(AndroidJUnit4::class)
class StartupTransitionReducedMotionJourneyTest {
    @get:Rule val compose = createComposeRule(effectContext = object : MotionDurationScale {
        override val scaleFactor = 0f
    })

    @Test fun disabledAnimationsRemoveTheOverlayWithoutDelayingTheDestination() {
        val starting = mutableStateOf(true)
        compose.mainClock.autoAdvance = false
        compose.setContent {
            StartupTransition(starting.value) { Text("Ready destination") }
        }
        compose.onNodeWithContentDescription("Trustroots").assertIsDisplayed()
        compose.runOnIdle { starting.value = false }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeByFrame()
        compose.waitForIdle()
        compose.onNodeWithText("Ready destination").assertIsDisplayed()
        compose.onNodeWithContentDescription("Trustroots").assertDoesNotExist()
    }
}
