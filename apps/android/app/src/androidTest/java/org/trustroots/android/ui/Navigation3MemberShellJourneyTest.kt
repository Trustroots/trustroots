package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedDispatcher
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertEquals
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination

@RunWith(AndroidJUnit4::class)
class Navigation3MemberShellJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousAlertStatus: String? = null
    private var previousAlertDestination: MessageDestination? = null
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    @Volatile private var circlesResponse = "[]"
    @Volatile private var circlesStatus = 200
    private val circleReads = AtomicInteger()
    private val membershipReads = AtomicInteger()
    private val joinedHarbour = AtomicBoolean(false)
    @Volatile private var expireMemberSearch = false
    private val fixture = LocalTransportFixture { request ->
        when {
            request.path.startsWith("/api/users?search=") -> if (expireMemberSearch) {
                LocalTransportFixture.Response("""{"message":"Session expired."}""", 401)
            } else {
                LocalTransportFixture.Response(
                    """[{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","location":"Harbour"}]""",
                )
            }
            request.path.startsWith("/api/users/steady-heron") -> LocalTransportFixture.Response(
                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
            )
            request.path.startsWith("/api/messages?") -> LocalTransportFixture.Response("[]")
            request.path == "/api/tribes?limit=150" -> {
                circleReads.incrementAndGet()
                val body = if (circlesStatus in 200..299) circlesResponse
                else """{"message":"The circle catalogue is temporarily unavailable."}"""
                LocalTransportFixture.Response(body, circlesStatus)
            }
            request.path == "/api/users/memberships/circle-harbour" -> {
                joinedHarbour.set(request.method == "POST")
                LocalTransportFixture.Response("{}")
            }
            request.path == "/api/users/memberships" -> {
                membershipReads.incrementAndGet()
                LocalTransportFixture.Response(
                    if (joinedHarbour.get()) """[{"tribe":{"_id":"circle-harbour"}}]""" else "[]",
                )
            }
            request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response("""{"features":[]}""")
            request.path.contains("/avatar?") -> LocalTransportFixture.Response("", 404)
            else -> LocalTransportFixture.Response("[]")
        }
    }

    @Before fun saveAndClearShellState() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousAlertStatus = MessageAlerts.status.value
        previousAlertDestination = MessageAlerts.destination.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        circlesResponse = "[]"
        circlesStatus = 200
        circleReads.set(0)
        membershipReads.set(0)
        joinedHarbour.set(false)
        expireMemberSearch = false
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
        )
    }

    @After fun closeScenarioAndRestoreShellState() {
        scenario?.close()
        fixture.close()
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousAlertDestination
        MessageAlerts.status.value = previousAlertStatus
    }

    @Test fun repeatedTabVisitsRestoreAcrossActivityRecreationAndPredictiveBack() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-circles").performClick()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()

        requirePredictiveBackSupport()
        cancelPredictiveBack()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()

        requireNotNull(scenario).recreate()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-circles").assertIsSelected()

        cancelPredictiveBack()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        completePredictiveBack()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        completePredictiveBack()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
    }

    @Test fun circlesVisitRetainsAccountStateAndFreshVisitsResetAndReload() {
        circlesResponse = """[
            {"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","description":"<p>Quiet sea routes.</p>","count":4,"image":false},
            {"_id":"circle-mountain","slug":"mountain-paths","label":"Mountain Circle","description":"<p>High mountain paths.</p>","count":7,"image":false}
        ]"""
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Quiet Harbour")
        compose.waitUntil(10_000) { circleReads.get() == 1 && membershipReads.get() == 1 }

        compose.onNodeWithText("Filter circles").performTextReplacement("sea")
        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.onNodeWithText("Join circle").performClick()
        waitForText("Leave circle")
        compose.waitUntil(5_000) { joinedHarbour.get() }
        val initialCircleReads = circleReads.get()
        val initialMembershipReads = membershipReads.get()

        requireNotNull(scenario).recreate()
        waitForText("Leave circle")
        assertEquals(initialCircleReads, circleReads.get())
        assertEquals(initialMembershipReads, membershipReads.get())
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Filter circles").assertIsDisplayed()
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Mountain Circle")
        compose.onNodeWithText("Filter circles").performTextReplacement("mountain")
        compose.onNodeWithText("Mountain Circle").performClick()
        waitForText("High mountain paths.")
        pressBack()
        compose.onNodeWithText("Mountain Circle").assertIsDisplayed()
        compose.onNodeWithText("Quiet Harbour").assertDoesNotExist()

        pressBack()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        pressBack()
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()
        assertEquals(2, circleReads.get())
        assertEquals(2, membershipReads.get())

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Mountain Circle")
        compose.waitUntil(5_000) { circleReads.get() == 3 && membershipReads.get() == 3 }
        compose.onNodeWithText("Filter circles").performTextReplacement("sea")
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Mountain Circle")
        compose.waitUntil(5_000) { circleReads.get() == 4 && membershipReads.get() == 4 }
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertIsDisplayed()
    }

    @Test fun failedCircleCatalogueLoadCanBeRetriedFromTheScreen() {
        circlesResponse = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","description":"A coastal circle.","count":4,"image":false}]"""
        circlesStatus = 503
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("The circle catalogue is temporarily unavailable.")
        circlesStatus = 200
        compose.onNodeWithText("Retry").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) { circleReads.get() >= 2 }
        waitForText("Quiet Harbour")
        assertEquals(2, circleReads.get())
        assertEquals(2, membershipReads.get())
    }

    @Test fun topLevelNavigationWaitsForDirtyProfileLeaveDecision() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performClick()
        waitForText("Tagline")
        compose.onNodeWithText("Tagline").performTextReplacement("A new anonymous line")
        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("A new anonymous line").assertIsDisplayed()

        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithText("Discard changes").performClick()
        waitForText("Search places")
        compose.onNodeWithTag("navigation-search").assertIsSelected()
        pressSystemBack()
        waitForText("View your profile")
        compose.onNodeWithText("A new anonymous line").assertDoesNotExist()
    }

    @Test fun menuChildRouteRestoresAfterActivityRecreationAndReturnsThroughItsOrigins() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("People you connect with on Trustroots will appear here.")

        requireNotNull(scenario).recreate()
        waitForText("People you connect with on Trustroots will appear here.")
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("View your profile").assertExists()

        pressSystemBack()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        pressSystemBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
    }

    @Test fun nestedSystemBackWaitsForDirtyEditProfileDecision() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        waitForText("Tagline")
        compose.onNodeWithText("Tagline").performTextReplacement("A fictional route change")
        compose.waitForIdle()

        pressSystemBack()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("A fictional route change").assertIsDisplayed()

        pressSystemBack()
        compose.onNodeWithText("Discard changes").performClick()
        waitForText("View your profile")
        pressSystemBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
    }

    @Test fun nestedPredictiveBackCancelsWithoutPoppingAndThenReturnsToMenuOrigin() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("People you connect with on Trustroots will appear here.")

        requirePredictiveBackSupport()
        cancelPredictiveBack()
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        completePredictiveBack()
        compose.onNodeWithText("View your profile").assertExists()
        compose.onNodeWithTag("navigation-menu").assertIsSelected()

        completePredictiveBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
    }

    @Test fun memberSearchStateSurvivesModeTabAndActivityChangesAndResetsOnReselection() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()

        compose.onNodeWithTag("memberSearchField").performTextReplacement("quiet")
        compose.onNodeWithContentDescription("Search members").performClick()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        requireNotNull(scenario).recreate()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Hosts map").performClick()
        waitForText("Search places")
        selectMembersMode()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")

        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Discover circles")
        pressBack()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")

        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        waitForText("Find a member")
        assertMemberSearchText("")
        pressBack()
        waitForText("Search places")
        pressBack()
        waitForText("Discover circles")
        pressBack()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")

        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        assertMemberSearchText("")
        waitForText("Find a member")
        compose.onNodeWithTag("memberSearchField").performTextReplacement("after reset")
        requireNotNull(scenario).recreate()
        waitForText("Find a member")
        assertMemberSearchText("after reset")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })
    }

    @Test fun expiredMemberSearchClearsTheSearchEntryForANewAccount() {
        expireMemberSearch = true
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        compose.onNodeWithTag("memberSearchField").performTextReplacement("expired query")
        compose.onNodeWithContentDescription("Search members").performClick()
        waitForText("Your session expired or is no longer valid. Please sign in again.")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=second-fictional-session", MobileMember("amber-owl", "Amber Owl")),
        )
        requireNotNull(scenario).recreate()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        waitForText("Find a member")
        assertMemberSearchText("")
    }

    private fun selectMembersMode() {
        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithTag("memberSearchField").assertIsDisplayed()
    }

    private fun assertMemberSearchText(expected: String) {
        compose.onNodeWithTag("memberSearchField").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString(expected),
            ),
        )
    }

    private fun pressBack() {
        compose.waitForIdle()
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun requirePredictiveBackSupport() {
        assumeTrue("Predictive back event dispatch requires Android 14+", Build.VERSION.SDK_INT >= 34)
    }

    private fun pressSystemBack() {
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun cancelPredictiveBack() {
        withBackDispatcher { dispatcher ->
            dispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackProgressed(BackEventCompat(30f, 100f, 0.45f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackCancelled()
        }
    }

    private fun completePredictiveBack() {
        withBackDispatcher { dispatcher ->
            dispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackProgressed(BackEventCompat(30f, 100f, 0.9f, BackEventCompat.EDGE_LEFT))
            dispatcher.onBackPressed()
        }
    }

    private fun withBackDispatcher(action: (OnBackPressedDispatcher) -> Unit) {
        var dispatcher: OnBackPressedDispatcher? = null
        requireNotNull(scenario).onActivity { dispatcher = it.onBackPressedDispatcher }
        compose.runOnUiThread { action(requireNotNull(dispatcher)) }
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
