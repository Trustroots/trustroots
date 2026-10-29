package org.trustroots.android.ui.profile

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
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
import org.trustroots.android.ui.LocalTransportFixture

@RunWith(AndroidJUnit4::class)
class ProfileImageRestorationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val fixtureViewModelOwner = FixtureViewModelStoreOwner()
    private val releaseRestoredProfile = CountDownLatch(1)
    private val restoredProfileStarted = CountDownLatch(1)
    private val profileRequestCount = AtomicInteger()
    private lateinit var fixture: LocalTransportFixture

    @After fun releaseAndCloseFixture() {
        releaseRestoredProfile.countDown()
        fixtureViewModelOwner.viewModelStore.clear()
        if (::fixture.isInitialized) fixture.close()
    }

    @Test fun restoredOpenViewerSurvivesWhileFreshProfileLoadsThenClosesOnReplacement() {
        fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" -> {
                    if (profileRequestCount.incrementAndGet() == 1) {
                        LocalTransportFixture.Response(PROFILE)
                    } else {
                        restoredProfileStarted.countDown()
                        releaseRestoredProfile.await(10, TimeUnit.SECONDS)
                        LocalTransportFixture.Response(PROFILE)
                    }
                }
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("{}", status = 404)
                else -> LocalTransportFixture.Response("[]")
            }
        }
        val restoration = StateRestorationTester(compose)
        restoration.setContent {
            CompositionLocalProvider(LocalViewModelStoreOwner provides fixtureViewModelOwner) {
                DisposableEffect(fixtureViewModelOwner) {
                    onDispose { fixtureViewModelOwner.viewModelStore.clear() }
                }
                MemberProfileScreen(
                    api = MobileApiClient(fixture.baseURL),
                    session = MemberSession(
                        "connect.sid=fictional-profile-restore",
                        MobileMember("steady-heron", "Steady Heron"),
                    ),
                    username = "quiet-fox",
                    onSessionInvalidated = {},
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            profileRequestCount.get() == 1 &&
                compose.onAllNodesWithTag("profileAvatar").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileAvatar").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("Could not load profile photo.").fetchSemanticsNodes().isNotEmpty()
        }

        restoration.emulateSavedInstanceStateRestore()

        compose.waitUntil(10_000) {
            restoredProfileStarted.count == 0L &&
                compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("Could not load profile photo.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileImageViewer").assertIsDisplayed()
        compose.onNodeWithText("Could not load profile photo.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close profile photo").assertIsDisplayed()
        assertEquals("A fresh profile entry should issue a new request", 2, profileRequestCount.get())

        releaseRestoredProfile.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("profilePager").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isEmpty()
        }
        assertTrue(compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isEmpty())
    }

    private companion object {
        const val PROFILE = """{"_id":"member-main","username":"quiet-fox","displayName":"Quiet Fox"}"""
    }

    private class FixtureViewModelStoreOwner : ViewModelStoreOwner {
        override val viewModelStore = ViewModelStore()
    }
}
