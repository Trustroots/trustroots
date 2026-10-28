package org.trustroots.android.ui

import org.trustroots.android.ui.account.AccountSettingsScreen

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
import org.json.JSONObject
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
import org.trustroots.android.ui.profile.MemberProfileScreen

@RunWith(AndroidJUnit4::class)
class ProfileAndAccountOptionalStateJourneyTest {
    @get:Rule val compose = createComposeRule()

    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun anAuthenticationFailureSavingEmailKeepsTheDraftAndInvalidatesTheSession() {
        val requests = CopyOnWriteArrayList<LocalTransportFixture.Request>()
        val local = LocalTransportFixture { request ->
            requests += request
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(ACCOUNT_DETAILS)
                request.method == "PUT" && request.path == "/api/users" ->
                    LocalTransportFixture.Response("""{"message":"Please sign in again."}""", status = 401)
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }
        val session = MemberSession(
            "connect.sid=fictional-account-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        var invalidations = 0

        compose.setContent {
            NativeTestAppFrame(Destination.Menu) {
                AccountSettingsScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = { invalidations++ },
                    onBack = {},
                    onResetPassword = {},
                    onSignedOut = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("old@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Email address").performTextReplacement("new@example.test")
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()

        compose.waitUntil(10_000) {
            invalidations == 1 &&
                runCatching { compose.onNodeWithText("Save email settings").assertIsEnabled() }.isSuccess
        }

        compose.onNodeWithText("new@example.test").assertIsDisplayed()
        assertEquals(1, invalidations)
        assertEquals(listOf("GET" to "/api/users/steady-heron", "PUT" to "/api/users"), requests.map { it.method to it.path })
        assertEquals("connect.sid=fictional-account-session", requests.last().cookie)
        val payload = JSONObject(requests.last().body)
        assertEquals("new@example.test", payload.getString("email"))
        assertFalse(payload.getBoolean("newsletter"))
        assertTrue(compose.onAllNodesWithText("Account saved.").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Please sign in again.").fetchSemanticsNodes().isEmpty())
    }

    @Test fun aPublicReferenceWithoutFeedbackStillShowsItsAuthor() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(PROFILE)
                request.method == "GET" && request.path == "/api/offers-by/member-main?types=host" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contacts/member-main" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/experiences?userTo=member-main" ->
                    LocalTransportFixture.Response(REFERENCE_WITHOUT_FEEDBACK)
                request.method == "GET" && request.path == "/api/contact-by/member-main" ->
                    LocalTransportFixture.Response("{}", status = 404)
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(
                    "connect.sid=fictional-profile-session",
                    MobileMember("steady-heron", "Steady Heron"),
                ),
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithText("Reference Author").performScrollTo().assertIsDisplayed()
    }

    @Test fun ownProfileOffersEditingAndOmitsOtherMemberActions() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/member-self?types=host" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contacts/member-self" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/experiences?userTo=member-self" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/contact-by/member-self" ->
                    LocalTransportFixture.Response("{}", status = 404)
                request.path.contains("/avatar?") -> LocalTransportFixture.Response("", status = 404)
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient(local.baseURL),
                session = MemberSession(
                    "connect.sid=fictional-own-profile-session",
                    MobileMember("steady-heron", "Steady Heron"),
                ),
                username = "steady-heron",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Steady Heron").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Edit your profile").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertDoesNotExist()
        compose.onNodeWithContentDescription("More profile actions").assertDoesNotExist()
        compose.onNodeWithText("Report member").assertDoesNotExist()
        compose.onNodeWithContentDescription("View Steady Heron profile photo").performClick()
        compose.onNodeWithText("Could not load profile photo.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close profile photo").performClick()
        compose.onNodeWithText("Steady Heron").assertIsDisplayed()
    }

    private companion object {
        const val ACCOUNT_DETAILS = """{"username":"steady-heron","displayName":"Steady Heron","email":"old@example.test","newsletter":false}"""
        const val PROFILE = """{"_id":"member-main","username":"quiet-fox","displayName":"Quiet Fox"}"""
        const val REFERENCE_WITHOUT_FEEDBACK = """[{"_id":"reference-private","userFrom":{"_id":"author-id","username":"reference-author","displayName":"Reference Author"}}]"""
    }
}
