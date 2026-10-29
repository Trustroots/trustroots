package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
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
class MemberProfileReloadFailureAfterSaveJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private var fixture: LocalTransportFixture? = null
    private var reloadGate: CountDownLatch? = null

    @After fun closeFixture() {
        reloadGate?.countDown()
        fixture?.close()
        fixture = null
    }

    @Test fun failedReloadAfterSuccessfulEditShowsErrorAndRestoresStatusBarStyle() {
        val reloadStarted = CountDownLatch(1)
        val releaseReload = CountDownLatch(1)
        reloadGate = releaseReload
        val oldCookie = "connect.sid=fictional-before-save"
        val newCookie = "connect.sid=fictional-after-save"
        val session = mutableStateOf(
            MemberSession(oldCookie, MobileMember("quiet-fox", "Quiet Fox")),
        )
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" && request.cookie == oldCookie ->
                    LocalTransportFixture.Response(profile("Quiet Fox", "Original line"))
                request.method == "PUT" && request.path == "/api/users" ->
                    LocalTransportFixture.Response(profile("New Fox", "A saved line"))
                request.method == "GET" && request.path == "/api/users/quiet-fox" && request.cookie == newCookie -> {
                    reloadStarted.countDown()
                    check(releaseReload.await(10, TimeUnit.SECONDS)) { "Timed out waiting to release the profile reload" }
                    LocalTransportFixture.Response("""{"message":"A fictional reload failure."}""", status = 503)
                }
                request.path == "/api/offers-by/fictional-profile-id?types=host" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contacts/fictional-profile-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/experiences?userTo=fictional-profile-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contact-by/fictional-profile-id" -> LocalTransportFixture.Response("{}", status = 404)
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path} (${request.cookie})")
            }
        }.also { fixture = it }

        lateinit var statusBars: WindowInsetsControllerCompat
        var expectedLightStatusBars = true
        compose.runOnUiThread {
            val activity = compose.activity
            expectedLightStatusBars = (activity.resources.configuration.uiMode and
                Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES
            statusBars = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            statusBars.isAppearanceLightStatusBars = expectedLightStatusBars
        }
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
            compose.onAllNodesWithText("Original line").fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue("The loaded profile should set light status bar icons", !statusBars.isAppearanceLightStatusBars)

        compose.onNodeWithText("Edit your profile").performClick()
        compose.onNodeWithText("Quiet Fox").performTextReplacement("New Fox")
        compose.runOnIdle {
            session.value = MemberSession(
                newCookie,
                MobileMember("quiet-fox", "Quiet Fox"),
            )
        }
        compose.onNodeWithText("Save changes").performClick()

        compose.waitUntil(10_000) {
            reloadStarted.count == 0L &&
                compose.onAllNodesWithText("A saved line").fetchSemanticsNodes().isNotEmpty()
        }
        val saveRequest = local.requests.single { it.method == "PUT" && it.path == "/api/users" }
        assertEquals(newCookie, saveRequest.cookie)
        assertTrue("The reload should use the rotated session", local.requests.any {
            it.method == "GET" && it.path == "/api/users/quiet-fox" && it.cookie == newCookie
        })

        releaseReload.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Back").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("New Fox").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("The profile error state should restore the host status bar style",
                expectedLightStatusBars, statusBars.isAppearanceLightStatusBars)
        }
        assertEquals(1, local.requests.count {
            it.method == "GET" && it.path == "/api/users/quiet-fox" && it.cookie == newCookie
        })
    }

    private fun profile(displayName: String, tagline: String): String =
        """{"_id":"fictional-profile-id","username":"quiet-fox","displayName":"$displayName","tagline":"$tagline","description":"A fictional profile description.","languages":[]}"""
}
