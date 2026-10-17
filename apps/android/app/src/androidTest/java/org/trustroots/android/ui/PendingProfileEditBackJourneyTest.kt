package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class PendingProfileEditBackJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val profileRequestStarted = CountDownLatch(1)
    private val releaseProfileResponse = CountDownLatch(1)
    private var fixture: LocalTransportFixture? = null

    @After fun releaseResponseAndCloseFixture() {
        releaseProfileResponse.countDown()
        fixture?.close()
    }

    @Test fun systemBackCancelsInitialEditWhileProfileIsLoading() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" -> {
                    profileRequestStarted.countDown()
                    check(releaseProfileResponse.await(15, TimeUnit.SECONDS)) {
                        "The test did not release the pending profile response"
                    }
                    LocalTransportFixture.Response(
                        """{"_id":"member-main","username":"steady-heron","displayName":"Steady Heron","tagline":"A fictional profile tagline."}""",
                    )
                }
                request.path == "/api/offers-by/member-main?types=host" ||
                    request.path == "/api/contacts/member-main" ||
                    request.path == "/api/experiences?userTo=member-main" ->
                    LocalTransportFixture.Response("[]")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }
        val onBack = AtomicBoolean(false)
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(local.baseURL),
                session = session,
                username = "steady-heron",
                onSessionInvalidated = {},
                startInEditMode = true,
                onBack = { onBack.set(true) },
            )
        }

        assertTrue(profileRequestStarted.await(10, TimeUnit.SECONDS))
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        assertFalse("Back while initial edit is active should cancel editing, not leave the profile", onBack.get())

        releaseProfileResponse.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional profile tagline.").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("Edit your profile").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("A fictional profile tagline.").assertIsDisplayed()
        compose.onNodeWithText("Edit your profile").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Save changes").fetchSemanticsNodes().isEmpty())
        assertFalse(onBack.get())
        assertTrue(local.requests.none { it.method == "PUT" })
    }
}
