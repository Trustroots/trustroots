package org.trustroots.android.ui.profile

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
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
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.common.LeaveGuard
import org.trustroots.android.ui.common.LocalLeaveGuard

@RunWith(AndroidJUnit4::class)
class MemberProfileLeaveGuardJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val fixture = LocalTransportFixture { request ->
        when (request.path) {
            "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}""",
            )
            else -> LocalTransportFixture.Response("[]")
        }
    }

    @After fun closeFixture() = fixture.close()

    @Test fun profileBackWaitsForTheShellLeaveGuardBeforePopping() {
        val backCount = AtomicInteger()
        val guardCount = AtomicInteger()
        val pendingLeave = mutableStateOf<(() -> Unit)?>(null)
        val leaveGuard = mutableStateOf<LeaveGuard?>({ action ->
            guardCount.incrementAndGet()
            pendingLeave.value = action
        })

        compose.setContent {
            CompositionLocalProvider(LocalLeaveGuard provides leaveGuard) {
                MemberProfileScreen(
                    api = MobileApiClient(fixture.baseURL),
                    session = MemberSession(
                        "connect.sid=fictional-profile-session",
                        MobileMember("steady-heron", "Steady Heron"),
                    ),
                    username = "quiet-fox",
                    onSessionInvalidated = {},
                    onBack = { backCount.incrementAndGet() },
                )
            }
        }

        compose.waitUntil(10_000) {
            fixture.requests.any { it.path == "/api/users/quiet-fox" } &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Back").assertIsDisplayed().performClick()
        compose.waitUntil(2_000) { guardCount.get() == 1 && pendingLeave.value != null }

        assertEquals("The profile waits for the shell's leave decision", 0, backCount.get())
        compose.runOnIdle { pendingLeave.value?.invoke() }
        compose.waitUntil(2_000) { backCount.get() == 1 }
    }
}
