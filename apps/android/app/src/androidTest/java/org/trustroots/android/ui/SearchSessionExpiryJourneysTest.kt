package org.trustroots.android.ui

import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapScreen
import org.trustroots.android.ui.membersearch.MemberSearchScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class SearchSessionExpiryJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun initialMapSearchInvalidatesSessionWhenOffersReturnUnauthorized() {
        val invalidations = AtomicInteger()
        val local = startFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") ->
                    LocalTransportFixture.Response(
                        """{"message":"Please sign in again."}""",
                        status = 401,
                    )
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                else -> error("Unexpected map request: ${request.method} ${request.path}")
            }
        }

        compose.setContent {
            TrustrootsTheme {
                HostMapScreen(
                    api = MobileApiClient(local.baseURL),
                    session = testSession,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    geocoderLookup = { _, _, _ -> emptyList<Address>() },
                    mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false) } },
                )
            }
        }

        compose.waitUntil(15_000) {
            invalidations.get() > 0 &&
                local.requests.any { it.method == "GET" && it.path.startsWith("/api/offers?") } &&
                compose.onAllNodesWithText("0 offers · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("mapStatistics").assertIsDisplayed()
        assertEquals(1, invalidations.get())
        val searches = local.requests.filter { it.path.startsWith("/api/offers?") }
        assertTrue(searches.isNotEmpty())
        assertTrue(searches.all { it.method == "GET" && it.cookie == testSession.cookieHeader })
        assertTrue(searches.all { it.path.contains("filters=") })
        assertTrue(local.requests.all { it.method == "GET" && it.cookie == testSession.cookieHeader })
    }

    @Test fun memberSearchActionInvalidatesSessionWhenSearchReturnsUnauthorized() {
        val invalidations = AtomicInteger()
        val local = startFixture { request ->
            if (request.method == "GET" && request.path.startsWith("/api/users?search=")) {
                LocalTransportFixture.Response(
                    """{"message":"Please sign in again."}""",
                    status = 401,
                )
            } else {
                error("Unexpected member-search request: ${request.method} ${request.path}")
            }
        }

        compose.setContent {
            TrustrootsTheme {
                MemberSearchScreen(
                    api = MobileApiClient(local.baseURL),
                    session = testSession,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                )
            }
        }

        compose.onNodeWithTag("memberSearchField").performTextInput("quiet fox")
        compose.onNodeWithContentDescription("Search members").performClick()
        compose.waitUntil(10_000) {
            invalidations.get() > 0 && local.requests.any { it.path.startsWith("/api/users?search=") }
        }

        compose.onNodeWithText("Find a member").assertIsDisplayed()
        compose.onNodeWithText("No members found. Try another name or username.").assertDoesNotExist()
        compose.onNodeWithText("Please sign in again.").assertDoesNotExist()
        assertEquals(1, invalidations.get())
        val searches = local.requests.filter { it.path.startsWith("/api/users?search=") }
        assertEquals(1, searches.size)
        assertEquals("GET", searches.single().method)
        assertEquals("/api/users?search=quiet+fox&limit=50", searches.single().path)
        assertEquals(testSession.cookieHeader, searches.single().cookie)
    }

    private fun startFixture(
        respond: (LocalTransportFixture.Request) -> LocalTransportFixture.Response?,
    ): LocalTransportFixture = LocalTransportFixture(respond).also { fixture = it }

    private companion object {
        val testSession = MemberSession(
            "connect.sid=fictional-search-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
    }
}
