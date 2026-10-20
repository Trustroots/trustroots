package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.editprofile.EditProfileScreen

@RunWith(AndroidJUnit4::class)
class FormTransportFailureJourneysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val session = MemberSession(
        "connect.sid=fictional-transport-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private var fixture: LocalTransportFixture? = null
    private var pendingResponseRelease: CountDownLatch? = null

    @After fun closeFixture() {
        pendingResponseRelease?.countDown()
        fixture?.close()
    }

    @Test fun experiencePostTransportFailureKeepsDraftAndRetryCanSucceed() {
        val offline = AtomicBoolean(true)
        val created = AtomicInteger()
        val invalidated = AtomicInteger()
        val apiFixture = LocalTransportFixture { request ->
            if (request.method == "POST" && request.path == "/api/experiences" && offline.get()) {
                null
            } else {
                LocalTransportFixture.Response("{}", status = 201)
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                CreateExperienceScreen(
                    api = MobileApiClient(apiFixture.baseURL),
                    session = session,
                    memberID = "member-two",
                    memberLabel = "Quiet Fox",
                    onSessionInvalidated = { invalidated.incrementAndGet() },
                    onBack = {},
                    onCreated = { created.incrementAndGet() },
                )
            }
        }

        compose.onNodeWithText("Public experience (optional)")
            .performScrollTo()
            .performTextReplacement("A fictional shared stay.")
        val initialTexts = visibleTexts()
        compose.onNodeWithText("Save changes").performClick()
        val errorText = awaitNewText(initialTexts, apiFixture, expectedRequests = 1)
        assertEquals(0, invalidated.get())
        compose.onNodeWithText(errorText).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("A fictional shared stay.").assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsEnabled()
        assertEquals(0, created.get())

        offline.set(false)
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { created.get() == 1 && apiFixture.requests.size >= 2 }
        compose.waitForIdle()
        assertEquals(0, invalidated.get())
        assertTrue(errorText !in visibleTexts())
        val attempts = apiFixture.requests.toList()
        assertTrue(attempts.size >= 2)
        attempts.forEach { request ->
            assertEquals("POST", request.method)
            assertEquals("/api/experiences", request.path)
            assertEquals("connect.sid=fictional-transport-session", request.cookie)
            val payload = JSONObject(request.body)
            assertEquals("member-two", payload.getString("userTo"))
            assertEquals("A fictional shared stay.", payload.getString("feedbackPublic"))
        }
    }

    @Test fun profilePutTransportFailureKeepsEditsAndRetryCanSucceed() {
        val offline = AtomicBoolean(true)
        val invalidated = AtomicInteger()
        val saved = AtomicReference<MemberProfile?>()
        val apiFixture = LocalTransportFixture { request ->
            if (request.method == "PUT" && request.path == "/api/users" && offline.get()) {
                null
            } else {
                val update = JSONObject(request.body)
                LocalTransportFixture.Response(
                    JSONObject()
                        .put("_id", "member-one")
                        .put("username", "steady-heron")
                        .put("displayName", update.getString("displayName"))
                        .put("tagline", update.getString("tagline"))
                        .put("description", update.getString("description"))
                        .put("locationLiving", update.getString("locationLiving"))
                        .put("locationFrom", update.getString("locationFrom"))
                        .put("languages", update.getJSONArray("languages"))
                        .toString(),
                )
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                EditProfileScreen(
                    api = MobileApiClient(apiFixture.baseURL),
                    session = session,
                    profile = profile(),
                    onSessionInvalidated = { invalidated.incrementAndGet() },
                    onCancel = {},
                    onSaved = { saved.set(it) },
                )
            }
        }

        compose.onNodeWithText("Tagline").performTextReplacement("A fictional updated tagline.")
        val initialTexts = visibleTexts()
        compose.onNodeWithText("Save changes").performClick()
        val errorText = awaitNewText(initialTexts, apiFixture, expectedRequests = 1)
        assertEquals(0, invalidated.get())
        compose.onNodeWithText(errorText).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("A fictional updated tagline.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsEnabled()
        assertEquals(null, saved.get())

        offline.set(false)
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { saved.get() != null && apiFixture.requests.size >= 2 }
        compose.waitForIdle()
        assertEquals(0, invalidated.get())
        assertTrue(errorText !in visibleTexts())
        val attempts = apiFixture.requests.toList()
        assertTrue(attempts.size >= 2)
        attempts.forEach { request ->
            assertEquals("PUT", request.method)
            assertEquals("/api/users", request.path)
            assertEquals("connect.sid=fictional-transport-session", request.cookie)
            assertEquals("A fictional updated tagline.", JSONObject(request.body).getString("tagline"))
        }
        assertEquals("A fictional updated tagline.", saved.get()?.tagline)
    }

    @Test fun accountLoadTransportFailureEndsLoadingAndReopeningAfterRecoveryLoadsDetails() {
        val offline = AtomicBoolean(true)
        val firstRequestReached = CountDownLatch(1)
        val releaseFirstResponse = CountDownLatch(1).also { pendingResponseRelease = it }
        val invalidated = AtomicInteger()
        val routeKey = mutableIntStateOf(0)
        val apiFixture = LocalTransportFixture { request ->
            if (request.method == "GET" && request.path == "/api/users/steady-heron" && offline.get()) {
                firstRequestReached.countDown()
                check(releaseFirstResponse.await(5, TimeUnit.SECONDS)) { "Test did not release the first account response" }
                null
            } else {
                LocalTransportFixture.Response(
                    """{"username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}""",
                )
            }
        }.also { fixture = it }

        compose.setContent {
            TrustrootsTheme {
                key(routeKey.intValue) {
                    AccountSettingsScreen(
                        api = MobileApiClient(apiFixture.baseURL),
                        session = session,
                        onSessionInvalidated = { invalidated.incrementAndGet() },
                        onBack = {},
                        onResetPassword = {},
                        onSignedOut = {},
                    )
                }
            }
        }

        assertTrue("The account request should reach the local fixture", firstRequestReached.await(5, TimeUnit.SECONDS))
        compose.waitUntil(5_000) { visibleTexts().contains("Signed in as Steady Heron (@steady-heron).") }
        val loadingTexts = visibleTexts()
        assertTrue(hasIndeterminateProgress())
        releaseFirstResponse.countDown()
        compose.waitUntil(10_000) {
            apiFixture.requests.size >= 1 && !hasIndeterminateProgress() &&
                visibleTexts().any { it !in loadingTexts && it !in ACCOUNT_CONTENT_TEXTS }
        }
        compose.waitForIdle()
        val errorText = visibleTexts().first { it !in loadingTexts && it !in ACCOUNT_CONTENT_TEXTS }
        compose.onNodeWithText(errorText).performScrollTo().assertIsDisplayed()
        assertFalse(hasIndeterminateProgress())
        compose.onNodeWithText("Signed in as Steady Heron (@steady-heron).").assertIsDisplayed()
        assertEquals(0, invalidated.get())
        assertTrue(apiFixture.requests.isNotEmpty())

        offline.set(false)
        val failedRequests = apiFixture.requests.size
        compose.runOnUiThread { routeKey.intValue++ }
        compose.waitUntil(10_000) {
            apiFixture.requests.size > failedRequests &&
                compose.onAllNodesWithText("member@example.test").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("member@example.test").performScrollTo().assertIsDisplayed()
        assertEquals(0, invalidated.get())
        assertTrue(errorText !in visibleTexts())
        val requests = apiFixture.requests.toList()
        assertTrue(requests.size > failedRequests)
        assertTrue(requests.all { it.method == "GET" && it.path == "/api/users/steady-heron" })
        assertTrue(requests.all { it.cookie == "connect.sid=fictional-transport-session" })
    }

    private fun profile() = MemberProfile(
        id = "member-one",
        username = "steady-heron",
        displayName = "Steady Heron",
        tagline = "An original fictional tagline.",
        description = "A fictional profile description.",
        location = null,
        languages = listOf("eng"),
    )

    private fun visibleTexts(): Set<String> = compose.onAllNodes(
        SemanticsMatcher("text semantics") { it.config.contains(SemanticsProperties.Text) },
        useUnmergedTree = true,
    ).fetchSemanticsNodes().flatMap { node ->
        node.config[SemanticsProperties.Text].map { it.text }
    }.toSet()

    private fun hasIndeterminateProgress(): Boolean = compose.onAllNodes(
        hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate),
    ).fetchSemanticsNodes().isNotEmpty()

    private fun awaitNewText(
        initialTexts: Set<String>,
        apiFixture: LocalTransportFixture,
        expectedRequests: Int,
    ): String {
        compose.waitUntil(10_000) {
            val currentTexts = visibleTexts()
            apiFixture.requests.size >= expectedRequests &&
                "Save changes" in currentTexts &&
                currentTexts.any { it !in initialTexts && it != "Saving…" }
        }
        compose.waitForIdle()
        return visibleTexts().first { it !in initialTexts && it != "Saving…" }
    }

    private companion object {
        val ACCOUNT_CONTENT_TEXTS = setOf(
            "Email",
            "Email address",
            "Community newsletter",
            "Save email settings",
            "Change password",
            "Current password",
            "New password",
            "Verify new password",
            "Forgot your password?",
            "Message alerts",
            "Receive an alert for an unread conversation after ten minutes. This requires an installed UnifiedPush distributor, such as ntfy.",
            "Turn on message alerts",
            "Sign out",
        )
    }
}
