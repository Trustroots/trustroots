package org.trustroots.android.ui.conversation

import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.ConversationRecipient
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MessageConversationBranchContractsTest {
    @Test
    fun onlyCookieOrAccountIdentityChangesRefreshTheConversation() = withScope { scope ->
        val repository = BranchRepository()
        val model = MessageConversationViewModel("recipient-id", repository, session(), scope)

        model.onEvent(MessageConversationEvent.SessionChanged(session()))
        assertEquals(1, repository.memberLookups)

        model.onEvent(MessageConversationEvent.SessionChanged(session(cookie = "connect.sid=renewed")))
        assertEquals(2, repository.memberLookups)
        assertEquals("steady-heron", model.state.value.currentUsername)

        model.onEvent(
            MessageConversationEvent.SessionChanged(
                MemberSession("connect.sid=renewed", MobileMember("quiet-fox", "Quiet Fox")),
            ),
        )
        assertEquals(3, repository.memberLookups)
        assertEquals("quiet-fox", model.state.value.currentUsername)
        assertEquals(2, repository.sessionUpdates)
    }

    @Test
    fun oldMessageLoadFailureAfterRefreshCannotReplaceCurrentState() = withScope { scope ->
        val oldLoad = CompletableDeferred<Result<List<DirectMessage>>>()
        val repository = BranchRepository().apply {
            messageHandler = {
                if (messageLookups == 1) withContext(NonCancellable) { oldLoad.await() }
                else Result.success(listOf(incoming))
            }
        }
        val model = MessageConversationViewModel("recipient-id", repository, session(), scope)
        assertEquals(1, repository.messageLookups)
        assertTrue(model.state.value.isLoading)

        model.onEvent(MessageConversationEvent.SessionChanged(session(cookie = "connect.sid=renewed")))
        assertEquals(2, repository.messageLookups)
        assertEquals(listOf(incoming), model.state.value.messages)
        assertTrue(model.state.value.messagesLoaded)
        assertFalse(model.state.value.isLoading)

        oldLoad.complete(Result.failure(IOException("A fictional stale load failure.")))

        assertEquals(listOf(incoming), model.state.value.messages)
        assertTrue(model.state.value.messagesLoaded)
        assertFalse(model.state.value.loadFailed)
        assertNull(model.state.value.failure)
        assertNull(model.state.value.pendingSessionInvalidation)
    }

    private class BranchRepository : MessageConversationRepository {
        var memberLookups = 0
        var messageLookups = 0
        var sessionUpdates = 0
        var messageHandler: suspend () -> Result<List<DirectMessage>> = { Result.success(listOf(incoming)) }

        override fun updateSession(session: MemberSession): Boolean {
            sessionUpdates++
            return true
        }

        override fun updateApi(api: MobileApiClient) = false

        override suspend fun member(memberID: String): Result<ConversationRecipient> {
            memberLookups++
            return Result.success(recipient)
        }

        override suspend fun messages(memberID: String): Result<List<DirectMessage>> {
            messageLookups++
            return messageHandler()
        }

        override suspend fun send(memberID: String, content: String): Result<DirectMessage> =
            Result.success(sent)

        override fun loadDraft(selfUsername: String, otherKey: String) = ""
        override fun saveDraft(selfUsername: String, otherKey: String, value: String) = Unit
        override fun clearDraft(selfUsername: String, otherKey: String) = Unit
    }

    private fun withScope(block: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            block(scope)
        } finally {
            scope.cancel()
        }
    }

    private fun session(cookie: String = "connect.sid=fictional-session") =
        MemberSession(cookie, MobileMember("steady-heron", "Steady Heron"))

    private companion object {
        val recipient = ConversationRecipient("recipient-id", "steady-owl", "Steady Owl")
        val incoming = DirectMessage("incoming-id", "A fictional incoming message",
            MessageMember(recipient.id, recipient.username, recipient.displayName))
        val sent = DirectMessage("sent-id", "A fictional sent message", MessageMember("self-id", "steady-heron", "Steady Heron"))
    }
}
