package org.trustroots.android.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.printToLog
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
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
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MemberProfileNestedEditRestorationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val graphOwner = TestGraphViewModelStoreOwner()
    private var fixture: LocalTransportFixture? = null
    private var releaseRestoredProfile: CountDownLatch? = null

    @After fun closeFixtureAndStores() {
        releaseRestoredProfile?.countDown()
        graphOwner.viewModelStore.clear()
        fixture?.close()
        fixture = null
    }

    @Test fun restoredNestedEditorLoadsProfileWithoutSavedHandoffThenCanSave() {
        val restoredProfileStarted = CountDownLatch(1)
        val releaseProfile = CountDownLatch(1)
        releaseRestoredProfile = releaseProfile
        val profileReads = AtomicInteger()
        val saved = AtomicBoolean(false)
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" -> {
                    if (profileReads.incrementAndGet() == 2) {
                        restoredProfileStarted.countDown()
                        check(releaseProfile.await(15, TimeUnit.SECONDS)) {
                            "Timed out waiting to release the restored editor's profile request"
                        }
                    }
                    LocalTransportFixture.Response(
                        if (saved.get()) profile(displayName = "Restored Heron", tagline = "Saved after restoration") else profile(),
                    )
                }
                request.method == "PUT" && request.path == "/api/users" -> {
                    saved.set(true)
                    LocalTransportFixture.Response(profile(displayName = "Restored Heron", tagline = "Saved after restoration"))
                }
                request.path == "/api/offers-by/fictional-self-id?types=host" -> LocalTransportFixture.Response("[]")
                request.path == "/api/contacts/fictional-self-id" -> LocalTransportFixture.Response("[]")
                request.path == "/api/experiences?userTo=fictional-self-id" -> LocalTransportFixture.Response("[]")
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }
        val restoration = StateRestorationTester(compose)

        restoration.setContent {
            CompositionLocalProvider(LocalViewModelStoreOwner provides graphOwner) {
                DisposableEffect(graphOwner) {
                    onDispose { graphOwner.viewModelStore.clear() }
                }
                TrustrootsTheme {
                    MemberProfileScreen(
                        api = MobileApiClient(local.baseURL),
                        session = MemberSession(
                            "connect.sid=fictional-profile-restore",
                            MobileMember("steady-heron", "Steady Heron"),
                        ),
                        username = "steady-heron",
                        onSessionInvalidated = {},
                        onBack = {},
                    )
                }
            }
        }

        compose.waitUntil(10_000) {
            profileReads.get() == 1 &&
                compose.onAllNodesWithText("Original profile line").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Edit your profile").performClick()
        compose.onNodeWithText("Name").assertIsDisplayed()
        assertEquals("The ordinary edit route receives its retained profile snapshot", 1, profileReads.get())

        restoration.emulateSavedInstanceStateRestore()

        try {
            compose.waitUntil("restored editor profile request", 10_000) {
                restoredProfileStarted.count == 0L
            }
        } catch (error: ComposeTimeoutException) {
            compose.onRoot(useUnmergedTree = true).printToLog("nested-profile-editor-no-reload")
            throw AssertionError(
                "Restored profile request did not start; reads=${profileReads.get()}, " +
                    "requests=${local.requests.joinToString { "${it.method} ${it.path}" }}",
                error,
            )
        }
        try {
            compose.waitUntil("restored edit screen remains visible while profile is loading", 5_000) {
                compose.onAllNodesWithText("Edit profile").fetchSemanticsNodes().isNotEmpty()
            }
        } catch (error: ComposeTimeoutException) {
            compose.onRoot(useUnmergedTree = true).printToLog("nested-profile-editor-route-not-restored")
            throw AssertionError(
                "Profile GET started but edit route was not visible; reads=${profileReads.get()}, " +
                    "requests=${local.requests.joinToString { "${it.method} ${it.path}" }}",
                error,
            )
        }
        assertEquals("The restored editor must refetch by its saved username", 2, profileReads.get())
        assertTrue("The restored editor stays on its edit route while loading", compose.onAllNodesWithText("Name")
            .fetchSemanticsNodes().isEmpty())

        releaseProfile.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Steady Heron").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Steady Heron").performTextReplacement("Restored Heron")
        compose.onNodeWithText("Save changes").performClick()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Saved after restoration").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(1, local.requests.count { it.method == "PUT" && it.path == "/api/users" })
        assertTrue(local.requests.count { it.method == "GET" && it.path == "/api/users/steady-heron" } >= 2)
        compose.onNodeWithText("Saved after restoration").assertIsDisplayed()
    }

    private fun profile(
        displayName: String = "Steady Heron",
        tagline: String = "Original profile line",
    ): String =
        """{"_id":"fictional-self-id","username":"steady-heron","displayName":"$displayName","tagline":"$tagline","description":"A fictional profile description.","languages":[]}"""

    private class TestGraphViewModelStoreOwner : ViewModelStoreOwner {
        override val viewModelStore = ViewModelStore()
    }
}
