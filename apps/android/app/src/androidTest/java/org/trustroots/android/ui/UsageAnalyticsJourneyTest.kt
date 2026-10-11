package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.analytics.AndroidUsageConsentStore
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.analytics.UsageTransport

@RunWith(AndroidJUnit4::class)
class UsageAnalyticsJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val bodies = mutableListOf<String>()
    private var cancellations = 0
    private val transport = object : UsageTransport {
        override fun send(body: String) { bodies.add(body) }
        override fun cancel() { cancellations++ }
    }

    @Before fun resetConsent() { AndroidUsageConsentStore(context).enabled = false }
    @After fun clearConsent() { AndroidUsageConsentStore(context).enabled = false }

    @Test fun memberOptsInNavigatesRestartsAndOptsOut() {
        val analytics = mutableStateOf(UsageAnalytics(AndroidUsageConsentStore(context), transport))
        val screen = mutableStateOf<UsageScreen?>(UsageScreen.Account)
        compose.setContent {
            key(analytics.value) {
                Column {
                    UsageScreenTracking(analytics.value, screen.value)
                    UsageAnalyticsSettings(analytics.value)
                    TextButton(onClick = { screen.value = UsageScreen.Search }) { Text("Open search") }
                }
            }
        }
        compose.runOnIdle { analytics.value.appOpened(); assertTrue(bodies.isEmpty()) }
        compose.onNodeWithText("Turn on usage analytics").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Open search").performClick()
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(listOf("/android/account", "/android/search"), paths())
            analytics.value = UsageAnalytics(AndroidUsageConsentStore(context), transport)
        }
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue(analytics.value.enabled.value)
            analytics.value.appOpened()
            assertEquals("app-open", JSONObject(bodies.last()).getJSONObject("payload").getString("name"))
        }
        compose.onNodeWithText("Turn off usage analytics").performClick()
        compose.waitForIdle()
        compose.runOnIdle {
            val count = bodies.size
            analytics.value.appOpened()
            screen.value = UsageScreen.Messages
            assertEquals(1, cancellations)
            assertEquals(count, bodies.size)
            analytics.value = UsageAnalytics(AndroidUsageConsentStore(context), transport)
        }
        compose.waitForIdle()
        compose.runOnIdle {
            assertFalse(analytics.value.enabled.value)
            assertEquals(4, bodies.size)
            assertFalse(paths().contains("/android/messages"))
            // Browser routes intentionally produce no native screen event.
            screen.value = null
        }
        compose.waitForIdle()
        compose.runOnIdle { assertEquals(4, bodies.size) }
    }

    private fun paths() = bodies.map { JSONObject(it).getJSONObject("payload").getString("url") }
}
