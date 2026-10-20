package org.trustroots.android.ui

import android.content.Context
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.AnnotatedString
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ConversationDraftWithoutUsernameJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val memberID = "member-id-${System.nanoTime()}"
    private val draftKey = "messages.thread.steady-heron-$memberID"
    private val preferences by lazy { context.getSharedPreferences("message_drafts", Context.MODE_PRIVATE) }
    private var fixture: LocalTransportFixture? = null
    private var previousDraft: String? = null
    private var hadPreviousDraft = false

    @After fun closeFixtureAndRestoreDraft() {
        try {
            fixture?.close()
        } finally {
            if (hadPreviousDraft) preferences.edit().putString(draftKey, previousDraft).commit()
            else preferences.edit().remove(draftKey).commit()
        }
    }

    @Test fun restoresAndPersistsDraftByMemberIDWhenUsernameIsAbsent() {
        hadPreviousDraft = preferences.contains(draftKey)
        previousDraft = preferences.getString(draftKey, null)
        val seededDraft = "A fictional reply saved by member ID."
        preferences.edit().putString(draftKey, seededDraft).commit()

        val apiFixture = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/mini/$memberID" ->
                    LocalTransportFixture.Response(
                        """{"_id":"$memberID","displayName":"Fictional Member"}""",
                    )
                request.method == "GET" && request.path == "/api/messages/$memberID?limit=100" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path.contains("/avatar?") ->
                    LocalTransportFixture.Response("", status = 404)
                else -> error("Unexpected API request: ${request.method} ${request.path}")
            }
        }.also { fixture = it }
        val invalidations = AtomicInteger()
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )

        compose.setContent {
            ConversationRouteTestHarness(
                api = MobileApiClient(apiFixture.baseURL),
                session = session,
                memberID = memberID,
                onSessionInvalidated = { invalidations.incrementAndGet() },
            )
        }

        compose.waitUntil(10_000) {
            apiFixture.requests.any {
                it.method == "GET" && it.path == "/api/messages/$memberID?limit=100"
            }
        }
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString(seededDraft),
            ),
        )

        val editedDraft = "$seededDraft Continued."
        compose.onNodeWithTag("messageComposer").performTextReplacement(editedDraft)
        compose.waitUntil(5_000) { preferences.getString(draftKey, null) == editedDraft }
        compose.onNodeWithTag("messageComposer").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString(editedDraft),
            ),
        )

        assertEquals(editedDraft, preferences.getString(draftKey, null))
        assertEquals(0, invalidations.get())
        assertEquals(
            listOf("/api/messages/$memberID?limit=100"),
            apiFixture.requests.filter { it.path.startsWith("/api/messages/") }.map { it.path },
        )
        assertEquals(
            session.cookieHeader,
            apiFixture.requests.single { it.path == "/api/messages/$memberID?limit=100" }.cookie,
        )
    }
}
