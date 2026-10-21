package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.serialization.NavBackStackSerializer
import androidx.navigation3.runtime.serialization.NavKeySerializer
import androidx.savedstate.serialization.decodeFromSavedState
import androidx.savedstate.serialization.encodeToSavedState
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.editprofile.EditProfileScreen
import org.trustroots.android.ui.menu.MenuNavigationDisplay
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class RestoredProfileEditorJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val session = MemberSession("connect.sid=fictional-restore", MobileMember("steady-heron", "Steady Heron"))

    @Test fun legacySavedEditorLoadsCurrentMemberSavesAndReturnsToMenu() {
        val serializer = NavBackStackSerializer<NavKey>(NavKeySerializer())
        val saved = encodeToSavedState(serializer, NavBackStack<NavKey>(
            MenuPageVisit(MenuPage.Menu, 41L),
            MenuPageVisit(MenuPage.EditProfile, 43L),
        ))
        val restored = decodeFromSavedState(serializer, saved)
        val updated = AtomicReference<MobileMember?>()
        val usage = AtomicReference<UsageScreen?>()
        LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response("""{"_id":"fictional-self","username":"steady-heron","displayName":"Steady Heron","languages":["eng"]}""")
                request.method == "PUT" && request.path == "/api/users" ->
                    LocalTransportFixture.Response("""{"_id":"fictional-self","username":"steady-heron","displayName":"Restored Traveller","languages":["eng"]}""")
                else -> LocalTransportFixture.Response("{}", 404)
            }
        }.use { fixture ->
            val api = MobileApiClient(fixture.baseURL)
            compose.setContent {
                TrustrootsTheme {
                    MenuNavigationDisplay(
                        initialVisitID = 41L, session = session, api = api,
                        onSessionInvalidated = {}, onMemberUpdated = updated::set, onSignedOut = {},
                        onCurrentUsageScreen = { _, screen -> usage.set(screen) },
                        isActiveTabVisit = true, onResetAvailable = { _, _ -> },
                        openFindPeople = {}, openCircles = {}, menuBackStack = restored,
                    )
                }
            }
            waitForText("Name")
            assertEquals(UsageScreen.EditProfile, usage.get())
            compose.onNodeWithText("Name").performTextReplacement("Restored Traveller")
            compose.onNodeWithText("Save changes").performClick()
            waitForText("View your profile")
            assertEquals(MobileMember("steady-heron", "Restored Traveller"), updated.get())
            assertEquals(listOf(MenuPageVisit(MenuPage.Menu, 41L)), restored.toList())
            assertEquals(UsageScreen.Menu, usage.get())
            assertTrue(fixture.requests.any { it.method == "PUT" && it.path == "/api/users" })
        }
    }

    @Test fun initialProfileLoadFailureShowsMessageAndAllowsReturning() {
        val returned = AtomicBoolean(false)
        LocalTransportFixture {
            LocalTransportFixture.Response("""{"message":"Profile temporarily unavailable"}""", 503)
        }.use { fixture ->
            val api = MobileApiClient(fixture.baseURL)
            compose.setContent {
                TrustrootsTheme {
                    EditProfileScreen(
                        api = api, session = session, username = session.member.username,
                        onSessionInvalidated = {}, onSaved = {}, onCancel = { returned.set(true) },
                    )
                }
            }
            waitForText("Profile temporarily unavailable")
            compose.onNodeWithText("Profile temporarily unavailable").assertIsDisplayed()
            compose.onNodeWithContentDescription("Back").performClick()
            assertTrue(returned.get())
            assertEquals(1, fixture.requests.size)
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
