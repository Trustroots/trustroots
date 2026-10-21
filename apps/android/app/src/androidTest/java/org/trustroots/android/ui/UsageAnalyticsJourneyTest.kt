package org.trustroots.android.ui

import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
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
import org.trustroots.android.ui.common.UsageAnalyticsSettings
import org.trustroots.android.ui.common.UsageScreenTracking

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

    @Test fun optedInAnalyticsDoesNotTrackScreensWithoutANativeDestination() {
        val bodies = mutableListOf<String>()
        var consentEnabled = false
        val consent = object : org.trustroots.android.analytics.UsageConsentStore {
            override var enabled: Boolean
                get() = consentEnabled
                set(value) { consentEnabled = value }
        }
        val transport = object : UsageTransport {
            override fun send(body: String) { bodies.add(body) }
            override fun cancel() = Unit
        }
        val analytics = UsageAnalytics(consent, transport)
        val screen = mutableStateOf<UsageScreen?>(UsageScreen.Account)
        val uriHandler = object : UriHandler {
            override fun openUri(uri: String) = Unit
        }
        compose.setContent {
            Column {
                UsageScreenTracking(analytics, screen.value)
                CompositionLocalProvider(LocalUriHandler provides uriHandler) {
                    UsageAnalyticsSettings(analytics)
                }
            }
        }

        compose.onNodeWithText("Usage analytics").assertIsOff().performClick().assertIsOn()
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(
                listOf("/android/account"),
                bodies.map { JSONObject(it).getJSONObject("payload").getString("url") },
            )
            assertTrue(analytics.enabled.value)
        }

        compose.runOnIdle { screen.value = null }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(
                "A browser destination must not create a native screen event while opted in",
                listOf("/android/account"),
                bodies.map { JSONObject(it).getJSONObject("payload").getString("url") },
            )
        }
    }

    @Test fun memberOptsInNavigatesRestartsAndOptsOut() {
        val analytics = mutableStateOf(UsageAnalytics(AndroidUsageConsentStore(context), transport))
        val screen = mutableStateOf<UsageScreen?>(UsageScreen.Account)
        var openedUri: String? = null
        val uriHandler = object : UriHandler {
            override fun openUri(uri: String) { openedUri = uri }
        }
        compose.setContent {
            key(analytics.value) {
                Column {
                    UsageScreenTracking(analytics.value, screen.value)
                    CompositionLocalProvider(LocalUriHandler provides uriHandler) {
                        UsageAnalyticsSettings(analytics.value)
                    }
                    TextButton(onClick = { screen.value = UsageScreen.Search }) { Text("Open search") }
                }
            }
        }
        compose.runOnIdle { analytics.value.appOpened(); assertTrue(bodies.isEmpty()) }
        compose.onNodeWithText("Usage analytics").assertIsOff()
        compose.onNodeWithText("Privacy policy").performClick()
        compose.runOnIdle {
            assertEquals("https://www.trustroots.org/privacy", openedUri)
            assertFalse(analytics.value.enabled.value)
            assertTrue(bodies.isEmpty())
        }
        compose.onNodeWithText("Usage analytics").assertIsOff().performClick().assertIsOn()
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
        compose.onNodeWithText("Usage analytics").assertIsOn().performClick().assertIsOff()
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
        compose.onNodeWithText("Usage analytics").assertIsOff()
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
