package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostOfferNotHostingPendingJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val saveStarted = CountDownLatch(1)
    private val releaseSave = CountDownLatch(1)
    private val backCalls = AtomicInteger()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        releaseSave.countDown()
        fixture?.close()
        fixture = null
    }

    @Test fun pendingUnavailableOfferSaveDisablesReasonAndBlocksBackUntilSuccess() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-member","username":"steady-heron","displayName":"Steady Heron"}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/fictional-member?types=host" ->
                    LocalTransportFixture.Response(
                        """[{"_id":"fictional-offer","status":"no","noOfferDescription":"Away this month","showOnlyInMyCircles":false}]""",
                    )
                request.method == "PUT" && request.path == "/api/offers/fictional-offer" -> {
                    saveStarted.countDown()
                    check(releaseSave.await(15, TimeUnit.SECONDS)) { "The test did not release the host-offer response" }
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-offer","status":"no","noOfferDescription":"Taking a break","showOnlyInMyCircles":false}""",
                    )
                }
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }

        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        compose.setContent {
            HostOfferScreen(
                api = MobileApiClient(local.baseURL),
                session = session,
                onSessionInvalidated = {},
                onBack = { backCalls.incrementAndGet() },
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Away this month").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Why you are not hosting")
            .performTextReplacement("Taking a break")
        compose.onNodeWithText("Save changes").assertIsEnabled().performClick()

        assertTrue("The local fixture should receive the PUT", saveStarted.await(10, TimeUnit.SECONDS))
        compose.onNodeWithText("Saving…").assertIsDisplayed().assertIsNotEnabled()
        compose.onNodeWithText("Why you are not hosting").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Cancel").assertIsNotEnabled()

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.runOnIdle { assertEquals("Back must not leave while the save is pending", 0, backCalls.get()) }
        compose.onNodeWithText("Why you are not hosting").assertIsDisplayed().assertIsNotEnabled()

        releaseSave.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Why you are not hosting").assertIsEnabled()
        compose.onNodeWithText("Saving…").assertDoesNotExist()

        val put = local.requests.single { it.method == "PUT" && it.path == "/api/offers/fictional-offer" }
        val payload = JSONObject(put.body)
        assertEquals("no", payload.getString("status"))
        assertEquals("Taking a break", payload.getString("noOfferDescription"))
        assertEquals("connect.sid=fictional-session", put.cookie)

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.runOnIdle { assertEquals("Back should work after the save completes", 1, backCalls.get()) }
        assertEquals(1, local.requests.count { it.method == "PUT" && it.path == "/api/offers/fictional-offer" })
    }
}
