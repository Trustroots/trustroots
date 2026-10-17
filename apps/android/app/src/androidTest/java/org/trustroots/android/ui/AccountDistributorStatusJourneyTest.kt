package org.trustroots.android.ui

import android.Manifest
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class AccountDistributorStatusJourneyTest {
    @get:Rule val notificationPermissionRule = GrantPermissionRule.grant(*notificationPermissionsToGrant())
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val context
        get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val preferences
        get() = context.getSharedPreferences("message-alerts", android.content.Context.MODE_PRIVATE)
    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))
    private var previousPreferences: Map<String, *> = emptyMap<String, Any>()
    private var previousStatus: String? = null
    private var fixture: LocalTransportFixture? = null

    @Before fun isolateDistributorState() {
        previousPreferences = preferences.all
        previousStatus = MessageAlerts.status.value
        preferences.edit().clear().commit()
        MessageAlerts.status.value = null
    }

    @After fun restoreDistributorState() {
        try {
            fixture?.close()
        } finally {
            restorePreferences(preferences, previousPreferences)
            MessageAlerts.status.value = previousStatus
        }
    }

    @Test fun distributorStateOverridesCallbackStatusUntilFlowIsCleared() {
        val local = LocalTransportFixture { request ->
            check(request.method == "GET" && request.path == "/api/users/steady-heron") {
                "Unexpected account fixture request: ${request.method} ${request.path}"
            }
            LocalTransportFixture.Response(
                """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}""",
            )
        }.also { fixture = it }
        val callbackStatus = "The selected push provider is ready."
        val callbackResult = AtomicReference<String?>()
        MessageAlerts.status.value = "The push distributor stopped message alerts."

        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                    enableMessageAlerts = { _, _, onResult ->
                        callbackResult.set(callbackStatus)
                        onResult(callbackStatus)
                    },
                )
            }
        }

        waitForText("member@example.test")
        compose.onNodeWithText("Turn on message alerts").performScrollTo().performClick()
        compose.waitUntil(5_000) { callbackResult.get() == callbackStatus }

        compose.onNodeWithText("The push distributor stopped message alerts.")
            .performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText(callbackStatus).assertDoesNotExist()

        compose.runOnIdle { MessageAlerts.status.value = null }
        waitForText(callbackStatus)
        compose.onNodeWithText(callbackStatus).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("The push distributor stopped message alerts.").assertDoesNotExist()
        assertEquals(1, local.requests.count { it.method == "GET" && it.path == "/api/users/steady-heron" })
        assertEquals("The account fixture should receive only the account read", 1, local.requests.size)
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun restorePreferences(preferences: android.content.SharedPreferences, values: Map<String, *>) {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
        values.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }

    private fun notificationPermissionsToGrant(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray()
        }
}
