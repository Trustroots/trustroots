package org.trustroots.android.ui.editprofile

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class EditProfileScreenBranchesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun whitespaceOnlyNameKeepsProfileSaveDisabled() {
        val session = session()
        val apiFixture = LocalTransportFixture { request ->
            LocalTransportFixture.Response("{}", status = if (request.method == "PUT") 200 else 404)
        }.also { fixture = it }
        val saved = AtomicInteger()

        compose.setContent {
            TrustrootsTheme {
                EditProfileScreen(
                    api = MobileApiClient(apiFixture.baseURL),
                    session = session,
                    profile = profile(session),
                    onSessionInvalidated = {},
                    onCancel = {},
                    onSaved = { saved.incrementAndGet() },
                )
            }
        }

        compose.onNodeWithText("Name").performTextReplacement(" \t ")
        compose.onNodeWithText("Save changes").assertIsNotEnabled()
        assertTrue("A blank-name edit must not submit a profile update", apiFixture.requests.isEmpty())
        assertEquals(0, saved.get())
    }

    @Test fun loadAuthenticationFailureInvalidatesSessionAndLeavesBackActionUsable() {
        val session = session()
        val apiFixture = LocalTransportFixture { request ->
            if (request.method == "GET" && request.path == "/api/users/quiet-fox") {
                LocalTransportFixture.Response("""{"message":"Please sign in again."}""", status = 401)
            } else {
                LocalTransportFixture.Response("{}", status = 404)
            }
        }.also { fixture = it }
        val invalidations = AtomicInteger()
        val cancelCalls = AtomicInteger()

        compose.setContent {
            TrustrootsTheme {
                EditProfileScreen(
                    api = MobileApiClient(apiFixture.baseURL),
                    session = session,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onCancel = { cancelCalls.incrementAndGet() },
                    onSaved = {},
                    username = "quiet-fox",
                )
            }
        }

        compose.waitUntil(10_000) {
            invalidations.get() == 1 &&
                compose.onAllNodesWithContentDescription("Back").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Back").assertIsDisplayed().performClick()
        compose.waitForIdle()

        assertEquals(1, invalidations.get())
        assertEquals(1, cancelCalls.get())
        assertEquals(1, apiFixture.requests.size)
        assertEquals("GET", apiFixture.requests.single().method)
        assertEquals("/api/users/quiet-fox", apiFixture.requests.single().path)
        assertEquals(session.cookieHeader, apiFixture.requests.single().cookie)
        assertTrue(compose.onAllNodesWithText("Please sign in again.").fetchSemanticsNodes().isEmpty())
    }

    private fun session() = MemberSession(
        "connect.sid=fictional-edit-session",
        MobileMember("quiet-fox", "Quiet Fox"),
    )

    private fun profile(session: MemberSession) = MemberProfile(
        id = "fictional-member",
        username = session.member.username,
        displayName = "Quiet Fox",
        tagline = "A fictional quiet place.",
        description = null,
        location = null,
        languages = emptyList(),
    )
}
