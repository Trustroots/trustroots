package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.view.inputmethod.InputMethodManager
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertSame
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement
import org.trustroots.android.MainActivity
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination

@RunWith(AndroidJUnit4::class)
class MainActivityRotationJourneyTest {
    private val compose = createEmptyComposeRule()
    private val clearSavedSession = TestRule { base, _: Description ->
        object : Statement() {
            override fun evaluate() {
                InstrumentationRegistry.getInstrumentation().targetContext
                    .getSharedPreferences("mobile-session", 0)
                    .edit()
                    .clear()
                    .commit()
                base.evaluate()
            }
        }
    }

    @get:Rule val rules: TestRule = RuleChain.outerRule(clearSavedSession).around(compose)

    @Test fun keepsSignInFormAndActivityAcrossOrientationChanges() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("Username or email").performTextInput("anonymous-member")
            val originalActivity = arrayOfNulls<MainActivity>(1)

            scenario.onActivity { activity ->
                originalActivity[0] = activity
                val inputMethodManager = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                inputMethodManager.hideSoftInputFromWindow(
                    activity.currentFocus?.windowToken ?: activity.window.decorView.windowToken,
                    0,
                )
                activity.currentFocus?.clearFocus()
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            }
            compose.waitUntil(10_000) {
                scenarioState(scenario) == Configuration.ORIENTATION_LANDSCAPE
            }
            scenario.onActivity { assertSame(originalActivity[0], it) }
            compose.onNodeWithText("anonymous-member").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Sign in").performScrollTo().assertIsDisplayed()

            scenario.onActivity {
                it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }
            compose.waitUntil(10_000) {
                scenarioState(scenario) == Configuration.ORIENTATION_PORTRAIT
            }
            scenario.onActivity { assertSame(originalActivity[0], it) }
            compose.onNodeWithText("anonymous-member").performScrollTo().assertIsDisplayed()
        }
    }

    @Test fun newNotificationIntentUpdatesTheCurrentActivityAndConversation() {
        val previousDestination = MessageAlerts.destination.value
        MessageAlerts.clearDestination()
        try {
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val notificationIntent = arrayOfNulls<Intent>(1)
                scenario.onActivity { activity ->
                    notificationIntent[0] = Intent(activity.intent)
                        .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        .putExtra(MessageAlerts.ACCOUNT_EXTRA, "quiet-fox")
                        .putExtra(MessageAlerts.SENDER_EXTRA, "507f1f77bcf86cd799439012")
                    activity.startActivity(requireNotNull(notificationIntent[0]))
                }
                compose.waitUntil(5_000) {
                    MessageAlerts.destination.value == MessageDestination(
                        "quiet-fox",
                        "507f1f77bcf86cd799439012",
                    )
                }
                scenario.onActivity { activity ->
                    assertEquals("quiet-fox", activity.intent.getStringExtra(MessageAlerts.ACCOUNT_EXTRA))
                    assertEquals(
                        "507f1f77bcf86cd799439012",
                        activity.intent.getStringExtra(MessageAlerts.SENDER_EXTRA),
                    )
                    assertEquals(
                        MessageDestination("quiet-fox", "507f1f77bcf86cd799439012"),
                        MessageAlerts.destination.value,
                    )
                }
            }
        } finally {
            MessageAlerts.destination.value = previousDestination
        }
    }

    private fun scenarioState(scenario: ActivityScenario<MainActivity>): Int {
        val orientation = IntArray(1)
        scenario.onActivity { orientation[0] = it.resources.configuration.orientation }
        return orientation[0]
    }
}
