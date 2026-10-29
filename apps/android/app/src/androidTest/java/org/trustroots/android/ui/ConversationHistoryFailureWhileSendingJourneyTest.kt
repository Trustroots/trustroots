package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.ConversationRecipient
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.conversation.MessageConversationRepository
import org.trustroots.android.ui.conversation.MessageConversationViewModel
import org.trustroots.android.ui.conversation.MessageConversationEntryScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ConversationHistoryFailureWhileSendingJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val owner = TestConversationOwner()
    private val requestScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @After fun clearViewModelStore() {
        owner.viewModelStore.clear()
        requestScope.cancel()
    }

    @Test fun historyFailureDisablesRetryWithoutInterruptingPendingSend() {
        val repository = DeferredConversationRepository()
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val api = MobileApiClient("https://example.invalid")
        lateinit var model: MessageConversationViewModel

        compose.runOnUiThread {
            val prepared = MessageConversationViewModel(
                memberID = "fictional-member-id",
                repository = repository,
                initialSession = session,
                scope = requestScope,
            )
            model = ViewModelProvider(
                owner,
                object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T = prepared as T
                },
            ).get(MessageConversationViewModel::class.java)
        }

        compose.setContent {
            TrustrootsTheme {
                androidx.compose.runtime.CompositionLocalProvider(
                    LocalViewModelStoreOwner provides owner,
                ) {
                    MessageConversationEntryScreen(
                        memberID = "fictional-member-id",
                        api = api,
                        session = session,
                        onSessionInvalidated = {},
                        onBack = {},
                    )
                }
            }
        }

        compose.waitUntil(10_000) {
            model.state.value.member != null && repository.messageCalls.get() == 1 &&
                compose.onAllNodesWithTag("messageComposer").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("messageComposer").performTextInput("A fictional message while history loads.")
        hideTestKeyboard()
        compose.waitUntil(10_000) {
            ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
                ?.isVisible(WindowInsetsCompat.Type.ime()) != true
        }
        compose.onNodeWithContentDescription("Send").assertIsDisplayed().assertIsEnabled().performClick()
        compose.waitUntil(10_000) { repository.sendStarted.isCompleted }

        repository.history.complete(Result.failure(IOException("A fictional history lookup failed.")))
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("conversationFailure").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("conversationRetry").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("conversationFailure").assertIsDisplayed()
        compose.onNodeWithTag("conversationRetry").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Sending…").assertIsDisplayed()

        repository.sendResult.complete(Result.success(
            DirectMessage(
                id = "fictional-sent-message",
                content = "A fictional message while history loads.",
                sender = MessageMember("fictional-self-id", "steady-heron", "Steady Heron"),
            ),
        ))
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional message while history loads.")
                .fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("conversationFailure").fetchSemanticsNodes().isEmpty()
        }

        compose.onNodeWithText("A fictional message while history loads.").assertIsDisplayed()
        compose.onNodeWithTag("conversationRetry").assertDoesNotExist()
        assertEquals(1, repository.messageCalls.get())
    }

    @Test fun quickReplyActionsStayDisabledUntilPendingSendCompletes() {
        val repository = DeferredConversationRepository()
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val api = MobileApiClient("https://example.invalid")
        lateinit var model: MessageConversationViewModel

        compose.runOnUiThread {
            val prepared = MessageConversationViewModel(
                memberID = "fictional-member-id",
                repository = repository,
                initialSession = session,
                scope = requestScope,
            )
            model = ViewModelProvider(
                owner,
                object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T = prepared as T
                },
            ).get(MessageConversationViewModel::class.java)
        }

        compose.setContent {
            TrustrootsTheme {
                androidx.compose.runtime.CompositionLocalProvider(
                    LocalViewModelStoreOwner provides owner,
                ) {
                    MessageConversationEntryScreen(
                        memberID = "fictional-member-id",
                        api = api,
                        session = session,
                        onSessionInvalidated = {},
                        onBack = {},
                    )
                }
            }
        }

        compose.waitUntil(10_000) {
            model.state.value.member != null && repository.messageCalls.get() == 1
        }
        repository.history.complete(
            Result.success(
                listOf(
                    DirectMessage(
                        id = "fictional-incoming-message",
                        content = "Can you host?",
                        sender = MessageMember("fictional-member-id", "quiet-fox", "Quiet Fox"),
                    ),
                ),
            ),
        )
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Yes, I can host!").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Yes, I can host!").assertIsEnabled().performClick()
        compose.waitUntil(10_000) { repository.sendStarted.isCompleted }
        compose.waitUntil(5_000) {
            listOf("Yes, I can host!", "Sorry I can't host", "Write back").all { label ->
                runCatching { compose.onNodeWithText(label).assertIsNotEnabled() }.isSuccess
            }
        }
        compose.onNodeWithText("Yes, I can host!").assertIsNotEnabled()
        compose.onNodeWithText("Sorry I can't host").assertIsNotEnabled()
        compose.onNodeWithText("Write back").assertIsNotEnabled()
        assertEquals(1, repository.sendCalls.get())

        repository.sendResult.complete(
            Result.success(
                DirectMessage(
                    id = "fictional-sent-quick-reply",
                    content = "<p data-hosting=\"yes\"><b><i>Yes, I can host!</i></b></p>",
                    sender = MessageMember("fictional-self-id", "steady-heron", "Steady Heron"),
                ),
            ),
        )
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("quickReply").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("Yes, I can host!").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithTag("outgoingMessage").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithTag("outgoingMessage").assertIsDisplayed()
        compose.onNodeWithText("Sorry I can't host").assertDoesNotExist()
        assertTrue(model.state.value.messages.any { it.id == "fictional-sent-quick-reply" })
        assertEquals(1, repository.sendCalls.get())
    }

    private class TestConversationOwner : ViewModelStoreOwner {
        override val viewModelStore = ViewModelStore()
    }

    private class DeferredConversationRepository : MessageConversationRepository {
        val history = CompletableDeferred<Result<List<DirectMessage>>>()
        val sendStarted = CompletableDeferred<Unit>()
        val sendResult = CompletableDeferred<Result<DirectMessage>>()
        val messageCalls = AtomicInteger()
        val sendCalls = AtomicInteger()

        override suspend fun member(memberID: String): Result<ConversationRecipient> =
            Result.success(ConversationRecipient(memberID, "quiet-fox", "Quiet Fox"))

        override suspend fun messages(memberID: String): Result<List<DirectMessage>> {
            messageCalls.incrementAndGet()
            return history.await()
        }

        override suspend fun send(memberID: String, content: String): Result<DirectMessage> {
            sendCalls.incrementAndGet()
            sendStarted.complete(Unit)
            return sendResult.await()
        }

        override fun loadDraft(selfUsername: String, otherKey: String): String = ""
        override fun saveDraft(selfUsername: String, otherKey: String, value: String) = Unit
        override fun clearDraft(selfUsername: String, otherKey: String) = Unit
    }
}
