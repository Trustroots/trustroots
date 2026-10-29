package org.trustroots.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.analytics.UsageTransport
import org.trustroots.android.analytics.UsageConsentStore
import org.trustroots.android.ui.common.UsageScreenTracking

@RunWith(AndroidJUnit4::class)
class UsageScreenTrackingJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun tracksOnlyNamedScreensWhileConsentIsEnabled() {
        val consent = object : UsageConsentStore {
            override var enabled = true
        }
        val transport = RecordingTransport()
        val analytics = UsageAnalytics(consent, transport)
        lateinit var replaceScreen: (UsageScreen?) -> Unit

        compose.setContent {
            MaterialTheme {
                var screen by remember { mutableStateOf<UsageScreen?>(UsageScreen.Search) }
                replaceScreen = { screen = it }
                UsageScreenTracking(analytics, screen)
            }
        }
        compose.waitForIdle()

        assertEquals(1, transport.events.size)
        val payload = JSONObject(transport.events.single()).getJSONObject("payload")
        assertEquals("/android/search", payload.getString("url"))

        compose.runOnIdle { replaceScreen(null) }
        compose.waitForIdle()
        assertEquals(1, transport.events.size)

        compose.runOnIdle {
            analytics.setEnabled(false)
            replaceScreen(UsageScreen.Profile)
        }
        compose.waitForIdle()
        assertEquals(1, transport.events.size)
        assertEquals(1, transport.cancelCount)

        compose.runOnIdle { analytics.setEnabled(true) }
        compose.waitForIdle()
        assertEquals(2, transport.events.size)
        assertEquals("/android/profile", JSONObject(transport.events.last()).getJSONObject("payload").getString("url"))
    }

    private class RecordingTransport : UsageTransport {
        val events = mutableListOf<String>()
        var cancelCount = 0

        override fun send(body: String) {
            events += body
        }

        override fun cancel() {
            cancelCount++
        }
    }
}
