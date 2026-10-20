package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache

@RunWith(AndroidJUnit4::class)
class ContactsViewModelJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousAlertStatus: String? = null
    private var previousAlertDestination: org.trustroots.android.notifications.MessageDestination? = null
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private val contactsAttempts = AtomicInteger()
    @Volatile private var failContactsAttempts = 0
    @Volatile private var expireContacts = false
    private val fixture = LocalTransportFixture { request ->
        when {
            request.path == "/api/users/steady-heron" -> LocalTransportFixture.Response(
                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
            )
            request.path == "/api/contacts/member-self" -> {
                val attempt = contactsAttempts.incrementAndGet()
                when {
                    expireContacts -> LocalTransportFixture.Response("""{"message":"Session expired."}""", 401)
                    attempt <= failContactsAttempts -> LocalTransportFixture.Response(
                        """{"message":"Fictional contacts service is unavailable."}""",
                        503,
                    )
                    else -> LocalTransportFixture.Response(
                        """[{"_id":"contact-fox","user":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
                    )
                }
            }
            request.path == "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}""",
            )
            request.path.startsWith("/api/messages?") -> LocalTransportFixture.Response("[]")
            request.path == "/api/tribes?limit=150" -> LocalTransportFixture.Response("[]")
            request.path == "/api/users/memberships" -> LocalTransportFixture.Response("[]")
            request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response("""{"features":[]}""")
            request.path.contains("/avatar?") -> LocalTransportFixture.Response("", 404)
            else -> LocalTransportFixture.Response("[]")
        }
    }

    @Before
    fun saveAndClearShellState() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousAlertStatus = org.trustroots.android.notifications.MessageAlerts.status.value
        previousAlertDestination = org.trustroots.android.notifications.MessageAlerts.destination.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        org.trustroots.android.notifications.MessageAlerts.clearDestination()
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
        )
    }

    @After
    fun closeScenarioAndRestoreShellState() {
        scenario?.close()
        fixture.close()
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        org.trustroots.android.notifications.MessageAlerts.destination.value = previousAlertDestination
        org.trustroots.android.notifications.MessageAlerts.status.value = previousAlertStatus
    }

    @Test
    fun contactsRemainLoadedAcrossActivityRecreationAndBackFromContactProfile() {
        launchAndOpenContacts()
        waitForText("Quiet Fox")
        assertEquals(1, contactsAttempts.get())

        SecureResponseCache(context).clear(fixture.baseURL, "steady-heron")
        requireNotNull(scenario).recreate()
        waitForText("Quiet Fox")
        assertEquals("The retained entry should reuse its successful Contacts state", 1, contactsAttempts.get())

        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("About")
        pressBack()
        waitForText("Contacts")
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertEquals("Back from the selected profile should not reload Contacts", 1, contactsAttempts.get())
    }

    @Test
    fun recoverableContactsFailureCanBeRetriedSuccessfully() {
        failContactsAttempts = 1
        launchAndOpenContacts()
        waitForText("Fictional contacts service is unavailable.")
        compose.onNodeWithText("Try again").performClick()

        waitForText("Quiet Fox")
        assertEquals(2, contactsAttempts.get())
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
    }

    @Test
    fun expiredContactsRequestInvalidatesTheSessionAndRemovesTheEntry() {
        expireContacts = true
        launchAndOpenContacts()
        waitForText("Your session expired or is no longer valid. Please sign in again.")

        assertEquals(1, contactsAttempts.get())
        assertNull(SecureMobileSessionStore(context).load())
        assertTrue(compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isEmpty())
    }

    private fun launchAndOpenContacts() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        openContacts()
    }

    private fun openContacts() {
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performClick()
        compose.waitUntil(10_000) {
            contactsAttempts.get() > 0 ||
                compose.onAllNodesWithText("Your session expired or is no longer valid. Please sign in again.")
                    .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun pressBack() {
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun restorePreferences(preferences: android.content.SharedPreferences, values: Map<String, *>) {
        val editor = preferences.edit().clear()
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
}
