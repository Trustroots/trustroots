package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore

@RunWith(AndroidJUnit4::class)
class NativeSharedHomeJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessions = SecureMobileSessionStore(context)
    private val previousSession = sessions.load()
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private var fixture: LocalTransportFixture? = null

    @After fun restore() {
        scenario?.close()
        fixture?.close()
        previousSession?.let(sessions::save) ?: sessions.clear()
    }

    @Test fun sharedHomeUsesRegularTabsAndKeepsCirclesInProfileMenu() {
        sessions.save(MemberSession("", MobileMember("steady-heron", "Steady Heron"), accessToken = "fixture-access"))
        val api = LocalTransportFixture { request ->
            val payload = when (request.path.substringBefore('?')) {
                "/api/nostr/featured-notes" ->
                    """[{"id":"featured","content":"A note for the shared Home preview.","publishedAt":"2026-03-03T10:00:00Z"}]"""
                "/api/mobile/v0/connections" ->
                    """{"recent":[{"_id":"fox","username":"quiet-fox","displayName":"Quiet Fox","activity":"today"}],
                        "hosts":[{"_id":"fox","username":"quiet-fox","displayName":"Quiet Fox","location":[41.15,-8.61]}],
                        "meetings":[{"_id":"wren","username":"calm-wren","displayName":"Calm Wren","location":[48.86,2.35]}]}"""
                "/api/mobile/v0/profiles/quiet-fox" ->
                    """{"profile":{"_id":"fox","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Meet me on the trail."}}"""
                "/api/mobile/v0/profiles/steady-heron" ->
                    """{"profile":{"_id":"heron","username":"steady-heron","displayName":"Steady Heron"}}"""
                else -> "[]"
            }
            LocalTransportFixture.Response(payload)
        }.also { fixture = it }
        val activity = ActivityScenario.launch<SignInJourneyActivity>(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, api.baseURL)
                .putExtra(SHARED_HOME_EXTRA, true),
        ).also { scenario = it }

        waitForText("A note for the shared Home preview.")
        compose.onNodeWithTag("navigation-home").assertIsSelected()
        compose.onNodeWithTag("navigation-search").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsDisplayed()
        compose.onNodeWithTag("navigation-menu").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertDoesNotExist()
        compose.onNodeWithText("Exit shared pilot").assertDoesNotExist()
        compose.onNodeWithTag("pilot-connections-map").performScrollTo().assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_shared_home_shell")

        compose.onNodeWithText("Quiet Fox · Active today").performScrollTo().performClick()
        waitForText("Meet me on the trail.")
        activity.recreate()
        waitForText("Meet me on the trail.")
        compose.onNodeWithTag("navigation-home").assertIsSelected()
        activity.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        waitForText("A note for the shared Home preview.")

        compose.onNodeWithTag("navigation-search").performClick().assertIsSelected()
        compose.onNodeWithTag("navigation-home").performClick().assertIsSelected()
        waitForText("A note for the shared Home preview.")
        compose.onNodeWithTag("navigation-messages").performClick().assertIsSelected()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-home").performClick().assertIsSelected()
        waitForText("A note for the shared Home preview.")
        compose.onNodeWithTag("navigation-menu").performClick().assertIsSelected()
        compose.onNode(hasText("Circles") and hasAnyAncestor(hasTestTag("profileDestinationScreen")))
            .performScrollTo().performClick()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").assertIsSelected()
        compose.onNodeWithTag("navigation-home").performClick().assertIsSelected()
        waitForText("A note for the shared Home preview.")

        assertEquals("Bearer fixture-access", api.requests.first { it.path == "/api/mobile/v0/connections" }.authorization)
        assertNull(api.requests.first { it.path == "/api/nostr/featured-notes" }.authorization)
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
