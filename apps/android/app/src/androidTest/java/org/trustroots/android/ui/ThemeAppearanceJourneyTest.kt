package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.ui.startup.StartupScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ThemeAppearanceJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun systemAppearanceChangeUpdatesStartupScreenAndNativeControls() {
        val currentBackground = AtomicReference(Color.Unspecified)
        val currentContentColor = AtomicReference(Color.Unspecified)
        val baseContext = compose.activity
        val lightConfiguration = Configuration(baseContext.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_NO
        }
        val darkConfiguration = Configuration(baseContext.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
        }
        val lightContext = baseContext.createConfigurationContext(lightConfiguration)
        val darkContext = baseContext.createConfigurationContext(darkConfiguration)

        compose.setContent {
            var darkAppearance by remember { mutableStateOf(false) }
            val currentContext = if (darkAppearance) darkContext else lightContext
            CompositionLocalProvider(
                LocalContext provides currentContext,
                LocalConfiguration provides currentContext.resources.configuration,
            ) {
                TrustrootsTheme {
                    val background = MaterialTheme.colorScheme.background
                    val contentColor = LocalContentColor.current
                    SideEffect {
                        currentBackground.set(background)
                        currentContentColor.set(contentColor)
                    }
                    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f)) { StartupScreen("Quiet Fox") }
                        OutlinedTextField(
                            value = "",
                            onValueChange = {},
                            label = { Text("Search places") },
                        )
                        Button(onClick = {}) { Text("Continue") }
                        TextButton(onClick = { darkAppearance = !darkAppearance }) {
                            Text(if (darkAppearance) "Use light appearance" else "Use dark appearance")
                        }
                    }
                }
            }
        }

        compose.onNodeWithText("Travellers’ community").assertIsDisplayed()
        compose.onNodeWithText("Search places").assertIsDisplayed()
        compose.onNodeWithText("Continue").assertIsDisplayed()
        assertEquals(Color(lightContext.getColor(R.color.trustroots_background)), currentBackground.get())
        assertEquals(Color(lightContext.getColor(R.color.trustroots_on_surface)), currentContentColor.get())

        compose.onNodeWithText("Use dark appearance").performClick()

        compose.onNodeWithText("Travellers’ community").assertIsDisplayed()
        compose.onNodeWithText("Search places").assertIsDisplayed()
        compose.onNodeWithText("Continue").assertIsDisplayed()
        assertEquals(Color(darkContext.getColor(R.color.trustroots_background)), currentBackground.get())
        assertEquals(Color(darkContext.getColor(R.color.trustroots_on_surface)), currentContentColor.get())
        compose.onNodeWithText("Use light appearance").assertIsDisplayed()
    }
}
