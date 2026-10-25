package org.trustroots.android.ui

import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.membersearch.MemberSearchScreen

@RunWith(AndroidJUnit4::class)
class SearchControlsJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron"))
    private val members = """[{"username":"quiet-fox","displayName":"Quiet Fox"}]"""

    @Test fun clearingCircleFilterImmediatelyRestoresTheLoadedList() {
            LocalTransportFixture { request ->
                LocalTransportFixture.Response(if (request.path.startsWith("/api/tribes")) {
                """[{"_id":"circle-one","slug":"harbour","label":"Harbour Circle","count":3,"image":false},
                    {"_id":"circle-two","slug":"meadow","label":"Meadow Circle","count":2,"image":false}]"""
            } else "[]")
        }.use { fixture ->
            compose.setContent {
                NativeTestAppFrame(Destination.Circles) {
                    CirclesScreen(MobileApiClient(fixture.baseURL), session, {})
                }
            }
            waitFor("Harbour Circle")
            compose.onNodeWithContentDescription("Clear circle filter").assertDoesNotExist()
            compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("harbour")
            compose.onNodeWithContentDescription("Filter circles").assertIsDisplayed()
            compose.onNodeWithText("Meadow Circle").assertDoesNotExist()
            hideTestKeyboard()
            captureUsabilityScreenshot(compose, "android_circle_filter_clear")
            compose.onNodeWithContentDescription("Clear circle filter")
                .assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp).performClick()
            compose.onNodeWithText("Meadow Circle").assertIsDisplayed()
            compose.onNodeWithContentDescription("Clear circle filter").assertDoesNotExist()
            assertEquals(2, fixture.requests.size)
        }
    }

    @Test fun clearingConversationFilterRestoresAllRowsWithoutReloading() {
        LocalTransportFixture { LocalTransportFixture.Response("""[
            {"_id":"thread-one","userFrom":{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"A fictional greeting"},"read":true},
            {"_id":"thread-two","userFrom":{"_id":"member-owl","username":"amber-owl","displayName":"Amber Owl"},"userTo":{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"},"message":{"excerpt":"Another fictional greeting"},"read":true}
        ]""") }.use { fixture ->
            compose.setContent {
                NativeTestAppFrame(Destination.Messages) {
                    MessageInboxScreen(MobileApiClient(fixture.baseURL), session, {})
                }
            }
            waitFor("Quiet Fox")
            compose.onNodeWithTag("messageInboxFilter").performScrollTo().performTextReplacement("quiet")
            compose.onNodeWithContentDescription("Filter conversations").assertIsDisplayed()
            compose.onNodeWithText("Amber Owl").assertDoesNotExist()
            compose.onNodeWithContentDescription("Clear conversation filter").performClick()
            compose.onNodeWithText("Amber Owl").assertIsDisplayed()
            assertEquals(1, fixture.requests.count { it.path.startsWith("/api/messages?") })
        }
    }

    @Test fun keyboardSubmissionAndClearResetMemberResultsWithoutEmptySearch() {
        LocalTransportFixture { LocalTransportFixture.Response(members) }.use { fixture ->
            showMembers(fixture)
            compose.onNodeWithContentDescription("Clear member search").assertDoesNotExist()
            compose.onNodeWithTag("memberSearchField").performTextReplacement("ab")
            compose.onNodeWithTag("memberSearchField").performImeAction()
            compose.onNodeWithContentDescription("Search members").assertIsNotEnabled()
            assertEquals(0, fixture.requests.size)
            compose.onNodeWithTag("memberSearchField").performTextReplacement("quiet")
            compose.onNodeWithTag("memberSearchField").performImeAction()
            waitFor("Quiet Fox")
            compose.onNodeWithContentDescription("Search members")
                .assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
            compose.onNodeWithContentDescription("Clear member search")
                .assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
            captureUsabilityScreenshot(compose, "android_submitted_member_search")
            compose.onNodeWithContentDescription("Clear member search").performClick()
            compose.onNodeWithText("Quiet Fox").assertDoesNotExist()
            compose.onNodeWithText("Find a member").assertIsDisplayed()
            compose.onNodeWithContentDescription("Search members").assertIsNotEnabled()
            assertEquals(1, fixture.requests.size)
        }
    }

    @Test fun clearingMemberSearchDiscardsLateResults() = lateMemberResponse(members, 200)

    @Test fun clearingMemberSearchDismissesDisplayedError() {
        LocalTransportFixture {
            LocalTransportFixture.Response("""{"message":"Fictional search failure"}""", 503)
        }.use { fixture ->
            showMembers(fixture)
            compose.onNodeWithTag("memberSearchField").performTextReplacement("quiet")
            compose.onNodeWithContentDescription("Search members").performClick()
            waitFor("Fictional search failure")
            compose.onNodeWithContentDescription("Clear member search").performClick()
            compose.onNodeWithText("Fictional search failure").assertDoesNotExist()
            compose.onNodeWithText("Find a member").assertIsDisplayed()
            assertEquals(1, fixture.requests.size)
        }
    }

    @Test fun replacingMemberQueryDiscardsLateErrors() = lateMemberResponse(
        """{"message":"Obsolete search error"}""", 503, replacement = "meadow",
    )

    @Test fun clearingMemberQueryStillInvalidatesAnExpiredSession() = lateMemberResponse(
        """{"message":"Session expired"}""", 401, authenticationFailure = true,
    )

    private fun lateMemberResponse(
        body: String,
        status: Int,
        replacement: String = "",
        authenticationFailure: Boolean = false,
    ) {
        val requested = CountDownLatch(1)
        val release = CountDownLatch(1)
        val invalidated = AtomicBoolean()
        LocalTransportFixture {
            requested.countDown()
            check(release.await(10, TimeUnit.SECONDS))
            LocalTransportFixture.Response(body, status)
        }.use { fixture ->
            try {
                showMembers(fixture) { invalidated.set(true) }
                compose.onNodeWithTag("memberSearchField").performTextReplacement("quiet")
                compose.onNodeWithContentDescription("Search members").performClick()
                assertTrue(requested.await(5, TimeUnit.SECONDS))
                // Keyboard submission must also honour the in-flight guard.
                compose.onNodeWithTag("memberSearchField").performImeAction()
                compose.onNodeWithContentDescription("Clear member search").performClick()
                if (replacement.isNotEmpty()) {
                    compose.onNodeWithTag("memberSearchField").performTextReplacement(replacement)
                }
                release.countDown()
                if (authenticationFailure) {
                    compose.waitUntil(10_000) { invalidated.get() }
                } else if (replacement.isEmpty()) {
                    waitFor("Find a member")
                } else {
                    compose.waitUntil(10_000) {
                        compose.onAllNodesWithText("Find a member").fetchSemanticsNodes().isNotEmpty()
                    }
                }
                compose.onNodeWithText("Quiet Fox").assertDoesNotExist()
                compose.onNodeWithText("Obsolete search error").assertDoesNotExist()
                assertEquals(authenticationFailure, invalidated.get())
                assertEquals(1, fixture.requests.size)
            } finally {
                release.countDown()
            }
        }
    }

    private fun showMembers(fixture: LocalTransportFixture, onInvalidated: () -> Unit = {}) {
        compose.setContent {
            NativeTestAppFrame(Destination.Search) {
                MemberSearchScreen(MobileApiClient(fixture.baseURL), session, onInvalidated)
            }
        }
    }

    private fun waitFor(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
