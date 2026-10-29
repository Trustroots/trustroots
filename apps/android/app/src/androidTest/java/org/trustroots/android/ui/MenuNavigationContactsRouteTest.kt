package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.menu.MenuNavigationDisplay
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MenuNavigationContactsRouteTest {
    @get:Rule val compose = createComposeRule()
    private val fixture = LocalTransportFixture { request ->
        when (request.path) {
            "/api/users/steady-heron" -> LocalTransportFixture.Response(
                """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
            )
            "/api/contacts/member-self" -> LocalTransportFixture.Response(
                """[{"_id":"contact-one","user":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
            )
            "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A welcoming place to pause."}""",
            )
            "/api/offers-by/member-one?types=host" -> LocalTransportFixture.Response("[]")
            "/api/contacts/member-one" -> LocalTransportFixture.Response("[]")
            "/api/experiences?userTo=member-one" -> LocalTransportFixture.Response("[]")
            "/api/contact-by/member-one" -> LocalTransportFixture.Response("{}", 404)
            else -> LocalTransportFixture.Response("[]", 404)
        }
    }

    @After fun closeFixture() = fixture.close()

    @Test fun profileUsageReturnsToContactsAndMenuReselectionReloadsTheEntry() {
        val currentUsage = AtomicReference<UsageScreen?>()
        val resetMenu = AtomicReference<(() -> Unit)?>()
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        compose.setContent {
            TrustrootsTheme {
                MenuNavigationDisplay(
                    initialVisitID = 3L,
                    session = session,
                    api = MobileApiClient(fixture.baseURL),
                    onSessionInvalidated = {},
                    onMemberUpdated = {},
                    onSignedOut = {},
                    onCurrentUsageScreen = { _, screen -> currentUsage.set(screen) },
                    isActiveTabVisit = true,
                    onResetAvailable = { reset -> resetMenu.set(reset) },
                    browserContent = { _, _, _ -> },
                    contentPadding = androidx.compose.foundation.layout.PaddingValues.Zero,
                    openFindPeople = {},
                    openCircles = {},
                )
            }
        }

        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        assertEquals(UsageScreen.Contacts, currentUsage.get())
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        assertEquals(UsageScreen.Profile, currentUsage.get())

        compose.onNodeWithContentDescription("Back").performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        assertEquals(UsageScreen.Contacts, currentUsage.get())
        assertEquals(1, fixture.requests.count { it.path == "/api/contacts/member-self" })

        compose.runOnUiThread { requireNotNull(resetMenu.get()).invoke() }
        waitForText("View your profile")
        compose.onNodeWithText("A welcoming place to pause.").assertDoesNotExist()
        assertEquals(UsageScreen.Menu, currentUsage.get())
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.waitUntil(5_000) { fixture.requests.count { it.path == "/api/contacts/member-self" } == 2 }
        assertEquals(UsageScreen.Contacts, currentUsage.get())
        assertTrue(fixture.requests.any { it.path == "/api/users/quiet-fox" })
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }
}
