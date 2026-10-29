package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MemberContactConfirmationSessionRefreshJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null
    private var refreshGate: CountDownLatch? = null

    @After fun closeFixture() {
        refreshGate?.countDown()
        fixture?.close()
        fixture = null
    }

    @Test fun openRemovalConfirmationWaitsForRelationshipAfterSessionRefresh() {
        val oldCookie = "connect.sid=fictional-before-refresh"
        val newCookie = "connect.sid=fictional-after-refresh"
        val reloadStarted = CountDownLatch(1)
        val releaseReload = CountDownLatch(1)
        refreshGate = releaseReload
        val session = mutableStateOf(
            MemberSession(oldCookie, MobileMember("steady-heron", "Steady Heron")),
        )
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" && request.cookie == oldCookie ->
                    LocalTransportFixture.Response(profile())
                request.method == "GET" && request.path == "/api/users/quiet-fox" && request.cookie == newCookie -> {
                    reloadStarted.countDown()
                    check(releaseReload.await(15, TimeUnit.SECONDS)) { "Timed out waiting to release the refreshed profile" }
                    LocalTransportFixture.Response(profile())
                }
                request.path == "/api/offers-by/fictional-member-id?types=host" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contacts/fictional-member-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/experiences?userTo=fictional-member-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contact-by/fictional-member-id" ->
                    LocalTransportFixture.Response("""{"_id":"fictional-relationship-id","confirmed":true}""")
                request.path == "/api/blocked-users" -> LocalTransportFixture.Response("[]")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path} (${request.cookie})")
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                MemberProfileScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session.value,
                    username = "quiet-fox",
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("More profile actions").fetchSemanticsNodes().isNotEmpty()
        }
        openActionMenu()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Remove contact").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Remove contact").performClick()
        compose.onNodeWithText("Remove contact?").assertIsDisplayed()

        compose.runOnIdle {
            session.value = MemberSession(
                newCookie,
                MobileMember("steady-heron", "Steady Heron"),
            )
        }
        compose.waitUntil(10_000) { reloadStarted.count == 0L }

        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Delete contact request?").fetchSemanticsNodes().isNotEmpty() &&
                runCatching { compose.onNodeWithText("Confirm").assertIsNotEnabled() }.isSuccess
        }
        compose.onNodeWithText("Delete contact request?").assertIsDisplayed()
        compose.onNodeWithText("This cancels the pending contact request.").assertIsDisplayed()
        compose.onNodeWithText("Confirm").assertIsNotEnabled()
        assertEquals("The refreshed lookup is held before relationship state is restored", 0, local.requests.count {
            it.method == "GET" && it.path == "/api/contact-by/fictional-member-id" && it.cookie == newCookie
        })

        releaseReload.countDown()
        compose.waitUntil(10_000) {
            runCatching { compose.onNodeWithText("Confirm").assertIsEnabled() }.isSuccess &&
                compose.onAllNodesWithText("Remove contact?").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Remove contact?").assertIsDisplayed()
        compose.onNodeWithText("Confirm").assertIsEnabled()
        assertEquals(1, local.requests.count {
            it.method == "GET" && it.path == "/api/contact-by/fictional-member-id" && it.cookie == newCookie
        })

        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.onNodeWithText("Remove contact").assertIsDisplayed()
        assertTrue("Changing sessions while confirming must not send a delete", local.requests.none { it.method == "DELETE" })
    }

    private fun openActionMenu() {
        compose.onNodeWithContentDescription("More profile actions").assertIsDisplayed().performClick()
    }

    private fun profile(): String =
        """{"_id":"fictional-member-id","username":"quiet-fox","displayName":"Quiet Fox","description":"A fictional profile description.","languages":[]}"""
}
