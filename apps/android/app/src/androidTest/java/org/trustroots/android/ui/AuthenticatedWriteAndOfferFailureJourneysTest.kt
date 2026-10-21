package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class AuthenticatedWriteAndOfferFailureJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun unauthorizedOwnHostingOfferInvalidatesAfterProfileLoads() {
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when (request.method to request.path) {
                "GET" to "/api/users/steady-heron" -> LocalTransportFixture.Response(PROFILE)
                "GET" to "/api/offers-by/member-one?types=host" ->
                    LocalTransportFixture.Response("""{"message":"Session expired."}""", status = 401)
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture

        compose.setContent {
            HostOfferScreen(
                api = MobileApiClient(fixture.baseURL),
                session = TEST_SESSION,
                onSessionInvalidated = { invalidations.incrementAndGet() },
                onBack = {},
            )
        }

        compose.waitUntil(10_000) { invalidations.get() == 1 }

        val requests = fixture.requests.toList()
        assertEquals(
            listOf("/api/users/steady-heron", "/api/offers-by/member-one?types=host"),
            requests.map { it.path },
        )
        assertTrue(requests.all { it.method == "GET" && it.cookie == TEST_SESSION.cookieHeader })
        compose.onNodeWithText("Host").assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsNotEnabled()
        assertFalse(compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty())
        assertEquals("The expired offer lookup should invalidate the session exactly once", 1, invalidations.get())
    }

    @Test fun unauthorizedCircleJoinInvalidatesWithoutChangingMembership() {
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when (request.method to request.path) {
                "GET" to "/api/tribes?limit=150" -> LocalTransportFixture.Response(CIRCLES)
                "GET" to "/api/users/memberships" -> LocalTransportFixture.Response("[]")
                "POST" to "/api/users/memberships/circle-harbour" ->
                    LocalTransportFixture.Response("""{"message":"Session expired."}""", status = 401)
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture

        compose.setContent {
            CirclesScreen(
                api = MobileApiClient(fixture.baseURL),
                session = TEST_SESSION,
                onSessionInvalidated = { invalidations.incrementAndGet() },
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Harbour").fetchSemanticsNodes().isNotEmpty() &&
                fixture.requests.any { it.path == "/api/users/memberships" } &&
                compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
                    .fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.onNodeWithText("Join circle").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) { invalidations.get() == 1 }

        val requests = fixture.requests.toList()
        assertEquals(
            listOf(
                "GET" to "/api/tribes?limit=150",
                "GET" to "/api/users/memberships",
                "POST" to "/api/users/memberships/circle-harbour",
            ),
            requests.map { it.method to it.path },
        )
        assertTrue(requests.all { it.cookie == TEST_SESSION.cookieHeader })
        assertEquals("", requests.last().body)
        compose.onNodeWithText("Join circle").assertIsDisplayed()
        assertFalse(compose.onAllNodesWithText("Leave circle").fetchSemanticsNodes().isNotEmpty())
        assertEquals("A rejected join must invalidate exactly once", 1, invalidations.get())
    }

    @Test fun unavailableRelatedHostingOfferFinishesLoadingWithoutInvalidatingSession() {
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when (request.method to request.path) {
                "GET" to "/api/users/quiet-fox" -> LocalTransportFixture.Response(RELATED_PROFILE)
                "GET" to "/api/users/member-two/avatar?size=512" -> LocalTransportFixture.Response("", status = 404)
                "GET" to "/api/offers-by/member-two?types=host" ->
                    LocalTransportFixture.Response("""{"message":"Offer service unavailable."}""", status = 503)
                "GET" to "/api/contacts/member-two" -> LocalTransportFixture.Response("[]")
                "GET" to "/api/experiences?userTo=member-two" -> LocalTransportFixture.Response("[]")
                "GET" to "/api/contact-by/member-two" -> LocalTransportFixture.Response("{}", status = 404)
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(fixture.baseURL),
                session = TEST_SESSION,
                username = "quiet-fox",
                onSessionInvalidated = { invalidations.incrementAndGet() },
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            fixture.requests.any { it.path == "/api/offers-by/member-two?types=host" } &&
                compose.onAllNodesWithText("Not hosting currently").fetchSemanticsNodes().isNotEmpty()
        }
        val offerRequests = fixture.requests.filter { it.path == "/api/offers-by/member-two?types=host" }
        assertEquals(1, offerRequests.size)
        assertTrue(offerRequests.single().method == "GET" && offerRequests.single().cookie == TEST_SESSION.cookieHeader)
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Not hosting currently").performScrollTo().assertIsDisplayed()
        assertEquals("A non-auth hosting failure should finish its section without invalidating the session", 0, invalidations.get())
    }

    private companion object {
        val TEST_SESSION = MemberSession(
            "connect.sid=fictional-session-errors",
            MobileMember("steady-heron", "Steady Heron"),
        )
        const val PROFILE = """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron"}"""
        const val RELATED_PROFILE = """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}"""
        const val CIRCLES = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":4,"description":"A fictional circle for coastal travellers.","image":false}]"""
    }
}
