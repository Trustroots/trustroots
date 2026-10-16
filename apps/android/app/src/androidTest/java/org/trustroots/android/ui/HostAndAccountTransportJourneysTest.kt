package org.trustroots.android.ui

import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONObject
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostAndAccountTransportJourneysTest {
    @get:Rule val compose = createComposeRule()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
    }

    @Test fun hostingLoadTransportFailureCanRecoverAfterReopeningScreen() {
        val allowRecovery = AtomicBoolean(false)
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(profileJson)
                request.method == "GET" && request.path == "/api/offers-by/member-one?types=host" ->
                    if (allowRecovery.get()) LocalTransportFixture.Response("""[$recoveredOfferJson]""") else null
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture
        val screenGeneration = mutableIntStateOf(0)
        compose.setContent {
            key(screenGeneration.intValue) {
                HostOfferScreen(
                    api = MobileApiClient(fixture.baseURL),
                    session = testSession,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            val texts = visibleTexts()
            fixture.requests.any { it.path == "/api/offers-by/member-one?types=host" } &&
                "Hosting description" in texts &&
                texts.any { it.isNotBlank() && it !in HOST_LABELS }
        }
        val failedLoadRequests = fixture.requests.toList()
        assertTrue(failedLoadRequests.any { it.method == "GET" && it.path == "/api/users/steady-heron" })
        val failedOfferLookups = failedLoadRequests.filter { it.path == "/api/offers-by/member-one?types=host" }
        assertTrue(failedOfferLookups.isNotEmpty())
        assertTrue(failedOfferLookups.all { it.method == "GET" && it.cookie == "connect.sid=fictional-session" })
        compose.onNodeWithText("Hosting description").assertIsDisplayed()
        assertEquals(0, invalidations.get())

        allowRecovery.set(true)
        compose.runOnUiThread { screenGeneration.intValue++ }
        compose.waitUntil(10_000) {
            fixture.requests.size > failedLoadRequests.size &&
                compose.onAllNodesWithText("A recovered fictional hosting offer.").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(0, invalidations.get())
        val recoveryOfferLookups = fixture.requests.drop(failedLoadRequests.size)
            .filter { it.path == "/api/offers-by/member-one?types=host" }
        assertTrue(recoveryOfferLookups.isNotEmpty())
        assertTrue(recoveryOfferLookups.all { it.method == "GET" && it.cookie == "connect.sid=fictional-session" })
        compose.onNodeWithText("A recovered fictional hosting offer.").assertIsDisplayed()
    }

    @Test fun hostingSaveTransportFailurePreservesDescriptionAndCanRetry() {
        val allowRecovery = AtomicBoolean(false)
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(profileJson)
                request.method == "GET" && request.path == "/api/offers-by/member-one?types=host" ->
                    LocalTransportFixture.Response("""[$initialOfferJson]""")
                request.method == "PUT" && request.path == "/api/offers/fictional-offer" ->
                    if (allowRecovery.get()) LocalTransportFixture.Response(recoveredOfferJson) else null
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture
        compose.setContent {
            HostOfferScreen(
                api = MobileApiClient(fixture.baseURL),
                session = testSession,
                onSessionInvalidated = { invalidations.incrementAndGet() },
                onBack = {},
            )
        }

        compose.waitUntil(10_000) { compose.onAllNodesWithText("Hosting description").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Hosting description").performTextReplacement("A fictional spare room.")
        val initialRequests = fixture.requests.size
        val initialTexts = visibleTexts()
        compose.onNodeWithText("Save changes").performClick()
        val saveErrorText = waitForNewText(initialTexts, initialRequests)
        assertTrue(saveErrorText !in HOST_LABELS)
        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsEnabled()
        assertEquals(0, invalidations.get())
        val failedSaveRequests = fixture.requests.drop(initialRequests)
        assertTrue(failedSaveRequests.isNotEmpty())
        assertTrue(failedSaveRequests.all { request ->
            request.method == "PUT" && request.path == "/api/offers/fictional-offer" &&
                request.cookie == "connect.sid=fictional-session" &&
                JSONObject(request.body).let { body ->
                    val location = body.getJSONArray("location")
                    body.getString("description") == "A fictional spare room." &&
                        location.getDouble(0) == 30.25 && location.getDouble(1) == 12.5
                }
        })

        allowRecovery.set(true)
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            fixture.requests.size > initialRequests + failedSaveRequests.size &&
                compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()
        assertEquals(0, invalidations.get())
        val recoveredSaves = fixture.requests.drop(initialRequests + failedSaveRequests.size)
        assertTrue(recoveredSaves.isNotEmpty())
        assertTrue(recoveredSaves.all { request ->
            request.method == "PUT" && request.path == "/api/offers/fictional-offer" &&
                request.cookie == "connect.sid=fictional-session" &&
                JSONObject(request.body).let { body ->
                    val location = body.getJSONArray("location")
                    body.getString("description") == "A fictional spare room." &&
                        location.getDouble(0) == 30.25 && location.getDouble(1) == 12.5
                }
        })
    }

    @Test fun emailSettingsTransportFailureKeepsEditedValuesAndCanRetry() {
        val allowRecovery = AtomicBoolean(false)
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(profileJson)
                request.method == "PUT" && request.path == "/api/users" ->
                    if (allowRecovery.get()) {
                        LocalTransportFixture.Response(
                            """{"username":"steady-heron","displayName":"Steady Heron","email":"updated@example.test","newsletter":true}""",
                        )
                    } else null
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient(fixture.baseURL),
                session = testSession,
                onSessionInvalidated = { invalidations.incrementAndGet() },
                onBack = {},
                onResetPassword = {},
                onSignedOut = {},
            )
        }

        compose.waitUntil(10_000) { compose.onAllNodesWithText("original@example.test").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Email address").performTextReplacement("updated@example.test")
        val initialRequests = fixture.requests.size
        val initialTexts = visibleTexts()
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()
        val saveErrorText = waitForNewText(initialTexts, initialRequests)
        assertTrue(saveErrorText !in ACCOUNT_LABELS)
        compose.onNodeWithText("updated@example.test").assertIsDisplayed()
        compose.onNodeWithText("Community newsletter").assertIsDisplayed()
        compose.onNodeWithText("Save email settings").assertIsEnabled()
        assertTrue(fixture.requests.any { it.method == "GET" && it.path == "/api/users/steady-heron" })
        val failedSaves = fixture.requests.drop(initialRequests)
        assertTrue(failedSaves.isNotEmpty())
        assertTrue(failedSaves.all { request ->
            request.method == "PUT" && request.path == "/api/users" &&
                request.cookie == "connect.sid=fictional-session" &&
                JSONObject(request.body).let { body ->
                    body.getString("email") == "updated@example.test" && !body.getBoolean("newsletter")
                }
        })
        assertEquals(0, invalidations.get())

        allowRecovery.set(true)
        compose.onNodeWithText("Save email settings").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            fixture.requests.size > initialRequests + failedSaves.size &&
                compose.onAllNodesWithText("Account saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Account saved.").performScrollTo().assertIsDisplayed()
        assertEquals(0, invalidations.get())
        val recoveredSaves = fixture.requests.drop(initialRequests + failedSaves.size)
        assertTrue(recoveredSaves.isNotEmpty())
        assertTrue(recoveredSaves.all { request ->
            request.method == "PUT" && request.path == "/api/users" &&
                request.cookie == "connect.sid=fictional-session" &&
                JSONObject(request.body).let { body ->
                    body.getString("email") == "updated@example.test" && !body.getBoolean("newsletter")
                }
        })
    }

    @Test fun passwordChangeTransportFailurePreservesFieldsAndCanRetry() {
        val allowRecovery = AtomicBoolean(false)
        val invalidations = AtomicInteger()
        val fixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(profileJson)
                request.method == "POST" && request.path == "/api/users/password" ->
                    if (allowRecovery.get()) LocalTransportFixture.Response("{}") else null
                else -> error("Unexpected request: ${request.method} ${request.path}")
            }
        }
        this.fixture = fixture
        compose.setContent {
            AccountSettingsScreen(
                api = MobileApiClient(fixture.baseURL),
                session = testSession,
                onSessionInvalidated = { invalidations.incrementAndGet() },
                onBack = {},
                onResetPassword = {},
                onSignedOut = {},
            )
        }

        compose.waitUntil(10_000) { compose.onAllNodesWithText("original@example.test").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Current password").performScrollTo().performTextReplacement("fictional-current-secret")
        compose.onNodeWithText("New password").performScrollTo().performTextReplacement("fictional-replacement-secret")
        compose.onNodeWithText("Verify new password").performScrollTo().performTextReplacement("fictional-replacement-secret")
        val initialRequests = fixture.requests.size
        val initialTexts = visibleTexts()
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().performClick()

        var errorText: String? = null
        compose.waitUntil(10_000) {
            val texts = visibleTexts()
            errorText = texts.firstOrNull { it !in initialTexts && it.isNotBlank() && it != "Changing…" }
            fixture.requests.size > initialRequests && errorText != null &&
                runCatching {
                    compose.onNode(hasText("Change password") and hasClickAction()).assertIsEnabled()
                }.isSuccess
        }
        assertTrue(requireNotNull(errorText) !in ACCOUNT_LABELS)
        assertEquals(0, invalidations.get())
        val failedRequests = fixture.requests.drop(initialRequests)
        assertTrue(failedRequests.isNotEmpty())
        assertTrue(failedRequests.all { request ->
            request.method == "POST" && request.path == "/api/users/password" &&
                request.cookie == "connect.sid=fictional-session" &&
                JSONObject(request.body).let { body ->
                    body.getString("currentPassword") == "fictional-current-secret" &&
                        body.getString("newPassword") == "fictional-replacement-secret" &&
                        body.getString("verifyPassword") == "fictional-replacement-secret"
                }
        })

        allowRecovery.set(true)
        compose.onNode(hasText("Change password") and hasClickAction()).performScrollTo().performClick()
        compose.waitUntil(10_000) {
            fixture.requests.size > initialRequests + failedRequests.size &&
                compose.onAllNodesWithText("Password changed.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Password changed.").performScrollTo().assertIsDisplayed()
        assertEquals(0, invalidations.get())
        val recoveredRequests = fixture.requests.drop(initialRequests + failedRequests.size)
        assertTrue(recoveredRequests.isNotEmpty())
        assertTrue(recoveredRequests.all { request ->
            request.method == "POST" && request.path == "/api/users/password" &&
                request.cookie == "connect.sid=fictional-session" &&
                JSONObject(request.body).let { body ->
                    body.getString("currentPassword") == "fictional-current-secret" &&
                        body.getString("newPassword") == "fictional-replacement-secret" &&
                        body.getString("verifyPassword") == "fictional-replacement-secret"
                }
        })
    }

    private fun visibleTexts(): Set<String> = compose.onAllNodes(
        SemanticsMatcher("text semantics") { it.config.contains(SemanticsProperties.Text) },
        useUnmergedTree = true,
    ).fetchSemanticsNodes().flatMap { node ->
        node.config[SemanticsProperties.Text].map { it.text }
    }.toSet()

    private fun waitForNewText(initialTexts: Set<String>, requestCountBefore: Int): String {
        var newText: String? = null
        compose.waitUntil(10_000) {
            val texts = visibleTexts()
            newText = texts.firstOrNull { it !in initialTexts && it.isNotBlank() && it != "Saving…" }
            fixture!!.requests.size > requestCountBefore && newText != null &&
                runCatching {
                    if (compose.onAllNodesWithText("Save changes").fetchSemanticsNodes().isNotEmpty()) {
                        compose.onNodeWithText("Save changes").assertIsEnabled()
                    } else {
                        compose.onNodeWithText("Save email settings").assertIsEnabled()
                    }
                }.isSuccess
        }
        return requireNotNull(newText)
    }

    private companion object {
        val testSession = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        const val profileJson = """{"_id":"member-one","username":"steady-heron","displayName":"Steady Heron","email":"original@example.test","newsletter":false}"""
        const val initialOfferJson = """{"_id":"fictional-offer","status":"yes","description":"","maxGuests":2,"showOnlyInMyCircles":false,"location":[30.25,12.5]}"""
        const val recoveredOfferJson = """{"_id":"fictional-offer","status":"yes","description":"A recovered fictional hosting offer.","maxGuests":2,"showOnlyInMyCircles":false,"location":[30.25,12.5]}"""
        val HOST_LABELS = setOf(
            "Host", "Tell travellers whether you can host.", "Availability", "Yes", "Maybe", "No",
            "Hosting description", "Maximum guests", "Show only to members in my circles",
            "Save changes", "Cancel", "Write a longer hosting description first.", "Saving…",
            "Hosting offer saved.",
        )
        val ACCOUNT_LABELS = setOf(
            "Account", "Email", "Email address", "Community newsletter", "Save email settings",
            "Change password", "Current password", "New password", "Verify new password",
            "Change password", "Forgot your password?", "Message alerts",
            "Receive an alert for an unread conversation after ten minutes. This requires an installed UnifiedPush distributor, such as ntfy.",
            "Turn on message alerts", "Sign out", "Usage analytics", "Check account", "Saving…", "Account saved.",
        )
    }
}
