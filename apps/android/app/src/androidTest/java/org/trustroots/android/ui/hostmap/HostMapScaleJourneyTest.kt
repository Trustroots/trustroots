package org.trustroots.android.ui.hostmap

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HostMapScaleJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun showsTheScaleWhenAProjectedDistanceBecomesAvailable() {
        val scale = mutableStateOf<HostMapScale?>(null)
        compose.setContent { HostMapScaleBar(scale.value) }
        compose.onNodeWithTag("hostMapScale").assertDoesNotExist()
        compose.runOnIdle { scale.value = HostMapScale(500.0, 80f) }
        compose.onNodeWithTag("hostMapScale").assertIsDisplayed()
    }
}
