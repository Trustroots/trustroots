package org.trustroots.android.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen

/** Verifies that a retained profile entry reloads when its account and backend change. */
@RunWith(AndroidJUnit4::class)
class MemberProfileEnvironmentRefreshJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val fixtures = mutableListOf<LocalTransportFixture>()

    @After fun closeFixtures() {
        fixtures.forEach(LocalTransportFixture::close)
    }

    @Test fun retainedProfileReloadsForTheNewBackendAndSession() {
        val originalBackend = profileFixture("Quiet Fox")
        val currentBackend = profileFixture("Updated Fox")
        val backend = mutableStateOf(originalBackend.baseURL)
        val session = mutableStateOf(
            MemberSession("connect.sid=old-fictional", MobileMember("steady-heron", "Steady Heron")),
        )

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(backend.value),
                session = session.value,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        awaitProfileName("Quiet Fox")
        compose.runOnIdle {
            backend.value = currentBackend.baseURL
            session.value = MemberSession(
                "connect.sid=rotated-fictional",
                MobileMember("travelling-owl", "Travelling Owl"),
            )
        }
        awaitProfileName("Updated Fox")

        assertTrue(originalBackend.requests.any {
            it.path == "/api/users/quiet-fox" && it.cookie == "connect.sid=old-fictional"
        })
        assertTrue(currentBackend.requests.any {
            it.path == "/api/users/quiet-fox" && it.cookie == "connect.sid=rotated-fictional"
        })
        assertTrue(compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithText("Updated Fox").assertIsDisplayed()
    }

    private fun profileFixture(displayName: String) = LocalTransportFixture { request ->
        when {
            request.path == "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-fox","username":"quiet-fox","displayName":"$displayName"}""",
            )
            request.path == "/api/offers-by/member-fox?types=host" -> LocalTransportFixture.Response("[]")
            request.path == "/api/contacts/member-fox" -> LocalTransportFixture.Response("[]")
            request.path == "/api/experiences?userTo=member-fox" -> LocalTransportFixture.Response("[]")
            request.path == "/api/contact-by/member-fox" -> LocalTransportFixture.Response("{}", status = 404)
            request.path == "/api/blocked-users" -> LocalTransportFixture.Response("[]")
            else -> LocalTransportFixture.Response("{}", status = 404)
        }
    }.also(fixtures::add)

    private fun awaitProfileName(name: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(name).fetchSemanticsNodes().isNotEmpty()
        }
    }
}
