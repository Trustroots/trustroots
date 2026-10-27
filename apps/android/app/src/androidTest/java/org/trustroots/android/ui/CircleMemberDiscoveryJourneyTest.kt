package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class CircleMemberDiscoveryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun joinedCircleShowsContactsAndHostsAndOpensNativeProfile() {
        val local = discoveryFixture()
        fixture = local
        compose.setContent {
            TrustrootsTheme {
                CirclesScreen(
                    api = MobileApiClient(local.baseURL),
                    session = TEST_SESSION,
                    onSessionInvalidated = {},
                )
            }
        }

        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.onNodeWithText("Your contacts in this circle").assertIsDisplayed()
        compose.onNodeWithText("Other active members").assertIsDisplayed()
        compose.onNodeWithText("Calm Lynx").assertIsDisplayed()
        compose.onNodeWithText("Steady Heron").assertIsDisplayed()

        compose.onNodeWithTag("circleMember-calm-lynx").performClick()
        compose.onNodeWithText("Calm Lynx").assertIsDisplayed()

        val routes = local.requests.map { it.method to it.path }
        assertEquals(
            listOf(
                "GET" to "/api/tribes?limit=150",
                "GET" to "/api/users/memberships",
                "GET" to "/api/tribes/quiet-harbour",
                "GET" to "/api/users/memberships",
                "GET" to "/api/tribes/quiet-harbour/members",
            ),
            routes.take(5),
        )
        assertTrue(
            routes.toSet().containsAll(
                setOf(
                "GET" to "/api/users/calm-lynx",
                "GET" to "/api/offers-by/contact-id?types=host",
                "GET" to "/api/contacts/contact-id",
                "GET" to "/api/experiences?userTo=contact-id",
                "GET" to "/api/contact-by/contact-id",
                ),
            ),
        )
        assertTrue(local.requests.all { it.cookie == TEST_SESSION.cookieHeader })
    }

    private fun discoveryFixture() = LocalTransportFixture { request ->
        when (request.method to request.path) {
            "GET" to "/api/tribes?limit=150" -> LocalTransportFixture.Response(CIRCLES)
            "GET" to "/api/users/memberships" -> LocalTransportFixture.Response(MEMBERSHIPS)
            "GET" to "/api/tribes/quiet-harbour" -> LocalTransportFixture.Response(CIRCLE_DETAIL)
            "GET" to "/api/tribes/quiet-harbour/members" -> LocalTransportFixture.Response(MEMBER_GROUPS)
            "GET" to "/api/users/calm-lynx" -> LocalTransportFixture.Response(CONTACT_PROFILE)
            "GET" to "/api/offers-by/contact-id?types=host" -> LocalTransportFixture.Response("[]")
            "GET" to "/api/contacts/contact-id" -> LocalTransportFixture.Response("[]")
            "GET" to "/api/experiences?userTo=contact-id" -> LocalTransportFixture.Response("[]")
            "GET" to "/api/contact-by/contact-id" -> LocalTransportFixture.Response("{}", status = 404)
            else -> LocalTransportFixture.Response("{}", status = 404)
        }
    }

    private companion object {
        val TEST_SESSION = MemberSession(
            "connect.sid=fictional-circle-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        const val CIRCLES = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":2,"image":false}]"""
        const val MEMBERSHIPS = """[{"tribe":{"_id":"circle-harbour"}}]"""
        const val CIRCLE_DETAIL = """{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","count":2,"image":false}"""
        const val MEMBER_GROUPS = """{"contacts":[{"_id":"contact-id","username":"calm-lynx","displayName":"Calm Lynx"}],"recommenders":[],"active":[{"_id":"host-id","username":"steady-heron","displayName":"Steady Heron"}]}"""
        const val CONTACT_PROFILE = """{"_id":"contact-id","username":"calm-lynx","displayName":"Calm Lynx","tagline":"A fictional traveller"}"""
    }
}
