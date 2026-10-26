package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.testing.pressBackFromNonActivityRoot

/** Exercises member controls through the real profile navigation and authenticated API adapter. */
@RunWith(AndroidJUnit4::class)
class ProfileMemberSafetyJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val preferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private lateinit var previousPreferences: Map<String, *>
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private val blocked = AtomicBoolean(false)
    private val failBlock = AtomicBoolean(false)
    private val failLookup = AtomicBoolean(false)
    private val failReport = AtomicBoolean(false)
    private val holdBlockRequest = AtomicBoolean(false)
    private val blockRequestStarted = CountDownLatch(1)
    private val releaseBlockRequest = CountDownLatch(1)
    private val holdReportRequest = AtomicBoolean(false)
    private val reportRequestStarted = CountDownLatch(1)
    private val releaseReportRequest = CountDownLatch(1)
    private var targetUsername = "quiet-fox"
    private var targetName = "Quiet Fox"
    private val fixture = LocalTransportFixture { request ->
        when {
            request.path.contains("/avatar?") -> LocalTransportFixture.Response("", 404)
            request.path == "/api/blocked-users" -> if (failLookup.get()) {
                LocalTransportFixture.Response("""{"message":"Member controls are temporarily unavailable."}""", 503)
            } else LocalTransportFixture.Response(
                if (blocked.get()) """[{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}]""" else "[]",
            )
            request.path == "/api/blocked-users/quiet-fox" -> if (failBlock.get()) {
                LocalTransportFixture.Response("""{"message":"Please try this change again."}""", 503)
            } else {
                if (request.method == "PUT" && holdBlockRequest.get()) {
                    blockRequestStarted.countDown()
                    releaseBlockRequest.await(10, TimeUnit.SECONDS)
                }
                blocked.set(request.method == "PUT")
                LocalTransportFixture.Response(if (request.method == "PUT") "Member added to block list." else "{}")
            }
            request.path == "/api/support" -> if (failReport.get()) {
                LocalTransportFixture.Response("""{"message":"Support is temporarily unavailable."}""", 503)
            } else {
                if (holdReportRequest.get()) {
                    reportRequestStarted.countDown()
                    releaseReportRequest.await(10, TimeUnit.SECONDS)
                }
                LocalTransportFixture.Response("{}")
            }
            request.path.startsWith("/api/users?search=") -> LocalTransportFixture.Response(
                """[{"_id":"member-fox","username":"$targetUsername","displayName":"$targetName"}]""",
            )
            request.path == "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","description":"An anonymous profile."}""",
            )
            request.path == "/api/users/steady-heron" -> LocalTransportFixture.Response(
                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","email":"member@example.test"}""",
            )
            request.path.startsWith("/api/offers?") -> LocalTransportFixture.Response("""{"features":[]}""")
            else -> LocalTransportFixture.Response("[]")
        }
    }

    @Before fun saveSession() {
        previousPreferences = preferences.all
        preferences.edit().clear().commit()
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fictional-safety-session", MobileMember("steady-heron", "Steady Heron")),
        )
    }

    @After fun closeAndRestoreSession() {
        releaseBlockRequest.countDown()
        releaseReportRequest.countDown()
        scenario?.close()
        fixture.close()
        val editor = preferences.edit().clear()
        previousPreferences.forEach { (key, value) ->
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

    @Test fun blockAndUnblockRequireConfirmationAndUpdateTheMessageAction() {
        openProfile()
        openMenu()
        compose.onNodeWithTag("profileBlockAction").assertIsEnabled().performClick()
        compose.onNodeWithText("Cancel").performClick()
        assertFalse(fixture.requests.any { it.method == "PUT" })
        openMenu()
        compose.onNodeWithTag("profileBlockAction").performClick()
        compose.onNodeWithTag("confirmProfileBlock").performClick()
        waitForTag("profileBlockedNotice")
        compose.onNodeWithTag("profileMessageAction").assertDoesNotExist()
        compose.onNodeWithText("You have blocked Quiet Fox.").assertIsDisplayed()
        requireNotNull(scenario).recreate()
        waitForTag("profileBlockedNotice")
        openMenu()
        compose.onNodeWithText("Unblock member").performClick()
        compose.onNodeWithTag("confirmProfileBlock").performClick()
        waitForTag("profileMessageAction")
        compose.onNodeWithTag("profileBlockedNotice").assertDoesNotExist()
        assertEquals(listOf("PUT", "DELETE"), fixture.requests.filter { it.path.endsWith("/blocked-users/quiet-fox") }.map { it.method })
        assertTrue(fixture.requests.filter { it.path.startsWith("/api/blocked-users") }.all { it.cookie == "connect.sid=fictional-safety-session" })
    }

    @Test fun failedBlockKeepsThePreviousStateAndAllowsRetry() {
        failBlock.set(true)
        openProfile()
        openMenu()
        compose.onNodeWithTag("profileBlockAction").performClick()
        compose.onNodeWithTag("confirmProfileBlock").performClick()
        waitForText("Please try this change again.")
        assertFalse(blocked.get())
        compose.onNodeWithTag("profileBlockedNotice").assertDoesNotExist()
        failBlock.set(false)
        compose.onNodeWithTag("confirmProfileBlock").performClick()
        waitForTag("profileBlockedNotice")
        assertEquals(2, fixture.requests.count { it.method == "PUT" })
    }

    private fun pressDialogBack() {
        lateinit var activity: android.app.Activity
        requireNotNull(scenario).onActivity { activity = it }
        pressBackFromNonActivityRoot(activity)
    }

    @Test fun blockAndReportDialogsIgnoreBackWhileRequestsArePendingAndDismissAfterwards() {
        holdBlockRequest.set(true)
        openProfile()
        openMenu()
        compose.onNodeWithTag("profileBlockAction").performClick()
        compose.onNodeWithTag("confirmProfileBlock").performClick()
        assertTrue(blockRequestStarted.await(10, TimeUnit.SECONDS))
        compose.onNodeWithText("Updating…").assertIsDisplayed()
        pressDialogBack()
        compose.onNodeWithTag("confirmProfileBlock").assertIsDisplayed()

        releaseBlockRequest.countDown()
        waitForTag("profileBlockedNotice")
        holdBlockRequest.set(false)
        openMenu()
        compose.onNodeWithText("Unblock member").performClick()
        pressDialogBack()
        compose.onNodeWithTag("confirmProfileBlock").assertDoesNotExist()

        holdReportRequest.set(true)
        openMenu()
        compose.onNodeWithTag("profileReportAction").performClick()
        compose.onNodeWithTag("profileReportDetails").performTextReplacement("A fictional report while testing pending dismissal.")
        hideTestKeyboard()
        compose.onNodeWithTag("submitProfileReport").performClick()
        assertTrue(reportRequestStarted.await(10, TimeUnit.SECONDS))
        compose.onNodeWithText("Sending…").assertIsDisplayed()
        pressDialogBack()
        compose.onNodeWithTag("profileReportDetails").assertIsDisplayed()

        releaseReportRequest.countDown()
        waitForText("Report sent")
        pressDialogBack()
        compose.onNodeWithText("Report sent").assertDoesNotExist()
    }

    @Test fun failedLookupIsNotTreatedAsUnblockedAndHasRetry() {
        failLookup.set(true)
        openProfile()
        waitForText("Member controls are temporarily unavailable.")
        openMenu()
        compose.onNodeWithTag("profileBlockAction").assertIsNotEnabled()
        compose.onNodeWithTag("profileMessageAction").assertIsNotEnabled()
        compose.onNodeWithTag("profileReportAction").assertIsEnabled()
        compose.onNodeWithTag("profileReportAction").performClick()
        compose.onNodeWithText("Cancel").performClick()
        failLookup.set(false)
        compose.onNodeWithText("Retry").performClick()
        compose.waitUntil(10_000) { fixture.requests.count { it.path == "/api/blocked-users" } == 2 }
        compose.waitForIdle()
        openMenu()
        compose.onNodeWithTag("profileBlockAction").assertIsEnabled()
        compose.onNodeWithTag("profileMessageAction").assertIsEnabled()
    }

    @Test fun reportDraftSurvivesFailureAndRecreationWithoutRepeatingSubmission() {
        failReport.set(true)
        openProfile()
        openMenu()
        compose.onNodeWithTag("profileReportAction").performClick()
        compose.onNodeWithTag("submitProfileReport").assertIsNotEnabled()
        compose.onNodeWithTag("profileReportDetails").performTextReplacement("An anonymous report for the support team.")
        hideTestKeyboard()
        compose.onNodeWithTag("submitProfileReport").performClick()
        waitForText("Support is temporarily unavailable.")
        requireNotNull(scenario).recreate()
        waitForTag("profileReportDetails")
        compose.onNodeWithTag("profileReportDetails").assertTextEquals("Report details", "An anonymous report for the support team.")
        failReport.set(false)
        compose.onNodeWithTag("submitProfileReport").performClick()
        waitForText("Report sent")
        requireNotNull(scenario).recreate()
        waitForText("Report sent")
        val reports = fixture.requests.filter { it.path == "/api/support" }
        assertEquals(2, reports.size)
        assertEquals("POST", reports.last().method)
        assertEquals("quiet-fox", JSONObject(reports.last().body).getString("reportMember"))
        assertEquals("An anonymous report for the support team.", JSONObject(reports.last().body).getString("message"))
        compose.onNodeWithText("Done").performClick()
        openMenu()
        compose.onNodeWithTag("profileReportAction").performClick()
        compose.onNodeWithTag("submitProfileReport").assertIsNotEnabled()
    }

    @Test fun anAlreadyBlockedMemberHasUnblockAndReportButNoMessageAction() {
        blocked.set(true)
        openProfile()
        waitForTag("profileBlockedNotice")
        compose.onNodeWithTag("profileMessageAction").assertDoesNotExist()
        openMenu()
        compose.onNodeWithText("Unblock member").assertIsEnabled()
        compose.onNodeWithTag("profileReportAction").assertIsEnabled()
    }

    @Test fun ownProfileHasNoMemberSafetyActionsOrBlockLookup() {
        targetUsername = "steady-heron"
        targetName = "Steady Heron"
        openProfile()
        compose.onNodeWithTag("profileEditAction").assertIsDisplayed()
        compose.onNodeWithTag("profileActionsMenuButton").assertDoesNotExist()
        assertFalse(fixture.requests.any { it.path.startsWith("/api/blocked-users") })
    }

    private fun openProfile() {
        scenario = ActivityScenario.launch(Intent(context, SignInJourneyActivity::class.java).putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL))
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithTag("memberSearchField").performTextReplacement(targetUsername)
        compose.onNodeWithTag("submittedSearchButton").performClick()
        hideTestKeyboard()
        waitForText(targetName)
        compose.onNodeWithText(targetName).performClick()
        waitForTag("profileHero")
    }

    private fun openMenu() {
        compose.onNodeWithTag("profileActionsMenuButton").performClick()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    }
}
