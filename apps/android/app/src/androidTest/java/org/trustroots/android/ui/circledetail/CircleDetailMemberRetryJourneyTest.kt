package org.trustroots.android.ui.circledetail

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.Destination
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.NativeTestAppFrame
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CircleDetailMemberRetryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val releaseRetryCircle = CountDownLatch(1)
    private val retryCircleStarted = CountDownLatch(1)
    private var fixture: LocalTransportFixture? = null

    @After fun releaseAndCloseFixture() {
        releaseRetryCircle.countDown()
        fixture?.close()
        fixture = null
    }

    @Test fun retryKeepsJoinedCircleButDisablesMembershipUntilReloadCompletes() {
        val circleLoads = AtomicInteger()
        val groupLoads = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when (request.method to request.path) {
                "GET" to "/api/tribes?limit=150" -> LocalTransportFixture.Response(CIRCLES)
                "GET" to "/api/users/memberships" -> LocalTransportFixture.Response(MEMBERSHIPS)
                "GET" to "/api/tribes/quiet-harbour" -> {
                    if (circleLoads.incrementAndGet() == 2) {
                        retryCircleStarted.countDown()
                        check(releaseRetryCircle.await(10, TimeUnit.SECONDS)) {
                            "The test should release the retried circle lookup"
                        }
                    }
                    LocalTransportFixture.Response(CIRCLE_DETAIL)
                }
                "GET" to "/api/tribes/quiet-harbour/members" -> {
                    if (groupLoads.incrementAndGet() == 1) {
                        LocalTransportFixture.Response("{}", status = 500)
                    } else {
                        LocalTransportFixture.Response(MEMBER_GROUPS)
                    }
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }

        compose.setContent {
            NativeTestAppFrame(Destination.Circles) {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = MemberSession(
                        "connect.sid=fictional-circle-session",
                        MobileMember("steady-heron", "Steady Heron"),
                    ),
                    onSessionInvalidated = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Harbour").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.waitUntil(10_000) {
            groupLoads.get() == 1 && compose.onAllNodesWithText("Retry").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Leave circle").assertIsDisplayed().assertIsEnabled()
        compose.onNodeWithText("Retry").performClick()
        compose.waitUntil(10_000) { retryCircleStarted.count == 0L }

        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Leave circle").assertIsDisplayed().assertIsNotEnabled()
        assertTrue(compose.onAllNodesWithText("Your contacts in this circle").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Calm Lynx").fetchSemanticsNodes().isEmpty())

        releaseRetryCircle.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Calm Lynx").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Your contacts in this circle").assertIsDisplayed()
        compose.onNodeWithText("Calm Lynx").assertIsDisplayed()
        compose.onNodeWithText("Leave circle").assertIsEnabled()
        assertEquals(2, circleLoads.get())
        assertEquals(2, groupLoads.get())
    }

    private companion object {
        const val CIRCLES = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":2,"image":false}]"""
        const val MEMBERSHIPS = """[{"tribe":{"_id":"circle-harbour"}}]"""
        const val CIRCLE_DETAIL = """{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":2,"image":false}"""
        const val MEMBER_GROUPS = """{"contacts":[{"_id":"contact-calm-lynx","username":"calm-lynx","displayName":"Calm Lynx"}],"recommenders":[],"active":[]}"""
    }
}
