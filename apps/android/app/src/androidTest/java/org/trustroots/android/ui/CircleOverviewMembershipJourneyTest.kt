package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen

@RunWith(AndroidJUnit4::class)
class CircleOverviewMembershipJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun joinsAndLeavesFromTheOverviewAndKeepsMembershipWhenReturningFromDetail() {
        val joined = AtomicBoolean(false)
        val circle = """{"_id":"circle-one","slug":"quiet-circle","label":"Quiet Circle","count":7,"image":false,"description":"A fictional circle."}"""
        LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response("[$circle]")
                request.method == "GET" && request.path == "/api/tribes/quiet-circle" ->
                    LocalTransportFixture.Response(circle)
                request.method == "GET" && request.path == "/api/tribes/quiet-circle/members" ->
                    LocalTransportFixture.Response(EMPTY_MEMBER_GROUPS)
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response(if (joined.get()) """[{"tribe":{"_id":"circle-one"}}]""" else "[]")
                request.method == "POST" && request.path == "/api/users/memberships/circle-one" -> {
                    joined.set(true)
                    LocalTransportFixture.Response("{}")
                }
                request.method == "DELETE" && request.path == "/api/users/memberships/circle-one" -> {
                    joined.set(false)
                    LocalTransportFixture.Response("{}")
                }
                else -> error("Unexpected circle request: ${request.method} ${request.path}")
            }
        }.use { local ->
            compose.setContent {
                NativeTestAppFrame(Destination.Circles) {
                    CirclesScreen(
                        api = MobileApiClient(local.baseURL),
                        session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = { error("The fictional session must remain active") },
                    )
                }
            }
            waitForText("Join")
            compose.onNodeWithText("Join").performClick()
            waitForText("Joined")
            compose.onNodeWithText("Discover circles").assertIsDisplayed()
            compose.onNodeWithText("Joined").performClick()
            waitForText("Join")
            compose.onNodeWithText("Join").performClick()
            waitForText("Joined")
            compose.onNodeWithText("Quiet Circle").performClick()
            waitForText("Leave circle")
            compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
            compose.onNodeWithText("Discover circles").assertIsDisplayed()
            compose.onNodeWithText("Joined").assertIsDisplayed()

            val mutations = local.requests.filter { it.method == "POST" || it.method == "DELETE" }
            assertEquals(listOf("POST", "DELETE", "POST"), mutations.map { it.method })
            assertEquals(setOf("/api/users/memberships/circle-one"), mutations.map { it.path }.toSet())
            assertEquals(setOf("connect.sid=fictional"), mutations.map { it.cookie }.toSet())
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private companion object {
        const val EMPTY_MEMBER_GROUPS = """{"contacts":[],"recommenders":[],"active":[]}"""
    }
}
