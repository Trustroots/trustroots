package org.trustroots.android.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
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
import org.trustroots.android.ui.common.LeaveGuard
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.menu.MenuNavigationDisplay
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MenuNavigationLeaveGuardJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun resetAvailableWaitsForProvidedLeaveGuardBeforeReturningToMenuRoot() {
        val leaveGuard = mutableStateOf<LeaveGuard?>(null)
        val pendingLeave = mutableStateOf<(() -> Unit)?>(null)
        val guardCalls = AtomicInteger()
        val resetAvailable = mutableStateOf<(() -> Unit)?>(null)
        val local = menuFixture()
        showMenu(local, leaveGuard) { reset -> resetAvailable.value = reset }

        openContacts()
        compose.runOnIdle {
            leaveGuard.value = { action ->
                guardCalls.incrementAndGet()
                pendingLeave.value = action
            }
            requireNotNull(resetAvailable.value).invoke()
        }

        compose.waitUntil(2_000) { guardCalls.get() == 1 && pendingLeave.value != null }
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        assertEquals("Reset remains pending until the host grants permission", 1, guardCalls.get())

        compose.runOnIdle {
            leaveGuard.value = null
            pendingLeave.value?.invoke()
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("View your profile").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithContentDescription("Back").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        assertEquals(1, guardCalls.get())
    }

    @Test fun contactsBackWaitsForGuardThenRepeatedCapturedBackKeepsMenuRoot() {
        val leaveGuard = mutableStateOf<LeaveGuard?>(null)
        val pendingLeave = mutableStateOf<(() -> Unit)?>(null)
        val guardCalls = AtomicInteger()
        val local = menuFixture()
        showMenu(local, leaveGuard) {}

        openContacts()
        val back = requireNotNull(
            compose.onNodeWithContentDescription("Back")
                .fetchSemanticsNode().config[SemanticsActions.OnClick].action,
        )
        compose.runOnUiThread {
            leaveGuard.value = { action ->
                guardCalls.incrementAndGet()
                pendingLeave.value = action
            }
            back()
        }

        compose.waitUntil(2_000) { guardCalls.get() == 1 && pendingLeave.value != null }
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        assertEquals("The guarded Back action is held until released", 1, guardCalls.get())

        compose.runOnUiThread {
            leaveGuard.value = null
            pendingLeave.value?.invoke()
            back()
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("View your profile").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithContentDescription("Back").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("View your profile").assertIsDisplayed()
        assertTrue("Only the first Back action should leave Contacts", guardCalls.get() == 1)
    }

    private fun menuFixture() = LocalTransportFixture { request ->
        when (request.path) {
            "/api/users/steady-heron" -> LocalTransportFixture.Response(
                """{"_id":"fictional-self-id","username":"steady-heron","displayName":"Steady Heron"}""",
            )
            "/api/contacts/fictional-self-id" -> LocalTransportFixture.Response("[]")
            else -> LocalTransportFixture.Response("{}", status = 404)
        }
    }.also { fixture = it }

    private fun showMenu(
        local: LocalTransportFixture,
        leaveGuard: MutableState<LeaveGuard?>,
        onResetAvailable: (() -> Unit) -> Unit,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalLeaveGuard provides leaveGuard) {
                TrustrootsTheme {
                    MenuNavigationDisplay(
                        initialVisitID = 7L,
                        session = MemberSession(
                            "connect.sid=fictional-menu-session",
                            MobileMember("steady-heron", "Steady Heron"),
                        ),
                        api = MobileApiClient(local.baseURL),
                        onSessionInvalidated = {},
                        onMemberUpdated = {},
                        onSignedOut = {},
                        onCurrentUsageScreen = { _, _ -> },
                        isActiveTabVisit = true,
                        onResetAvailable = onResetAvailable,
                        browserContent = { _, _, _ -> },
                        contentPadding = PaddingValues.Zero,
                        openFindPeople = {},
                        openCircles = {},
                    )
                }
            }
        }
    }

    private fun openContacts() {
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            fixture?.requests?.any { it.path == "/api/contacts/fictional-self-id" } == true &&
                compose.onAllNodesWithContentDescription("Back").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
    }
}
