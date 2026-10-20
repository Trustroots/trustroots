package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CircleMembershipDepartureJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun unauthorizedLeaveKeepsExistingCircleMembership() {
        val invalidations = AtomicInteger()
        val local = membershipChangeFixture(deleteStatus = 401)
        fixture = local

        showCircles(local, invalidations)
        waitForCircleListLoadingToFinish(local)
        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.onNodeWithText("Leave circle").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) { invalidations.get() == 1 }
        waitForEnabledText("Leave circle")

        assertEquals(
            listOf("GET" to "/api/tribes?limit=150", "GET" to "/api/users/memberships", "DELETE" to "/api/users/memberships/circle-harbour"),
            local.requests.map { it.method to it.path },
        )
        val delete = local.requests.last()
        assertEquals(TEST_SESSION.cookieHeader, delete.cookie)
        assertEquals("", delete.body)
        compose.onNodeWithText("Leave circle").assertIsDisplayed().assertIsEnabled()
        assertEquals("A rejected leave must preserve membership and invalidate once", 1, invalidations.get())
    }

    @Test fun successfulLeaveRemovesExistingCircleMembership() {
        val invalidations = AtomicInteger()
        val local = membershipChangeFixture(deleteStatus = 200)
        fixture = local

        showCircles(local, invalidations)
        waitForCircleListLoadingToFinish(local)
        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.onNodeWithText("Leave circle").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) {
            local.requests.any { it.method == "DELETE" && it.path == "/api/users/memberships/circle-harbour" } &&
                runCatching { compose.onNodeWithText("Join circle").assertIsEnabled() }.isSuccess
        }

        assertEquals(
            listOf("GET" to "/api/tribes?limit=150", "GET" to "/api/users/memberships", "DELETE" to "/api/users/memberships/circle-harbour"),
            local.requests.map { it.method to it.path },
        )
        assertEquals(TEST_SESSION.cookieHeader, local.requests.last().cookie)
        compose.onNodeWithText("Join circle").assertIsDisplayed().assertIsEnabled()
        assertEquals(0, invalidations.get())
    }

    private fun showCircles(local: LocalTransportFixture, invalidations: AtomicInteger) {
        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = TEST_SESSION,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }
    }

    private fun waitForCircleListLoadingToFinish(local: LocalTransportFixture) {
        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/users/memberships" } &&
                compose.onAllNodes(
                    SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo),
                ).fetchSemanticsNodes().isEmpty()
        }
    }

    private fun waitForEnabledText(text: String) {
        compose.waitUntil(10_000) {
            runCatching { compose.onNodeWithText(text).assertIsEnabled() }.isSuccess
        }
    }

    private fun membershipChangeFixture(deleteStatus: Int): LocalTransportFixture = LocalTransportFixture { request ->
        when (request.method to request.path) {
            "GET" to "/api/tribes?limit=150" -> LocalTransportFixture.Response(CIRCLES)
            "GET" to "/api/users/memberships" ->
                LocalTransportFixture.Response("""[{"tribe":{"_id":"circle-harbour"}}]""")
            "DELETE" to "/api/users/memberships/circle-harbour" -> LocalTransportFixture.Response(
                if (deleteStatus == 200) "{}" else MEMBERSHIP_ERROR,
                status = deleteStatus,
            )
            else -> LocalTransportFixture.Response("{}", status = 404)
        }
    }

    private companion object {
        val TEST_SESSION = MemberSession(
            "connect.sid=fictional-circle-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        const val CIRCLES = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":4,"description":"A fictional circle for coastal travellers.","image":false}]"""
        const val MEMBERSHIP_ERROR = """{"message":"Circle membership could not be changed."}"""
    }
}
