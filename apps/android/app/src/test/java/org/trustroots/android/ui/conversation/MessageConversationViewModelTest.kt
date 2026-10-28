package org.trustroots.android.ui.conversation

import android.content.Context
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
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
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.UiFailureFallback

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class MessageConversationViewModelTest {
    @Test
    fun repositoryDefaultApiUpdateKeepsAStaticConversationRepository() {
        val repository = object : MessageConversationRepository by FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(emptyList()),
            initialDraft = "",
        ) {
            override fun updateApi(api: MobileApiClient): Boolean =
                super<MessageConversationRepository>.updateApi(api)
        }

        assertFalse(repository.updateApi(MobileApiClient("https://api.example.test")))
    }

    @Test
    fun resolvesRecipientWithoutAnInboxAndLoadsMessagesAndSavedDraft() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(listOf(incoming)),
            initialDraft = "A fictional saved draft",
        )
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)

        assertEquals(listOf("member-owl"), repository.memberLookups)
        assertEquals(listOf("member-owl"), repository.messageLookups)
        assertEquals("steady-owl", repository.loadedDraftKey)
        assertEquals("A fictional saved draft", model.state.value.draft)
        assertEquals(member, model.state.value.member)
        assertTrue(model.state.value.showQuickReply)
    }

    @Test
    fun draftAndSendAreIgnoredUntilTheRecipientLoads() = withScope { scope ->
        val lookupStarted = CompletableDeferred<Unit>()
        val loadedMember = CompletableDeferred<Result<MessageMember>>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(emptyList()),
            initialDraft = "A fictional saved draft",
        ).apply {
            memberHandler = {
                lookupStarted.complete(Unit)
                loadedMember.await()
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        assertTrue("The recipient lookup should be waiting", lookupStarted.isCompleted)

        model.onEvent(MessageConversationEvent.DraftChanged("A fictional early draft"))
        model.onEvent(MessageConversationEvent.Send("A fictional early message"))

        assertEquals("", model.state.value.draft)
        assertNull(repository.savedDraftKey)
        assertEquals(0, repository.sendCalls)

        loadedMember.complete(Result.success(member))

        assertEquals("A fictional saved draft", model.state.value.draft)
        assertEquals(member, model.state.value.member)
        assertEquals(0, repository.sendCalls)
    }

    @Test
    fun messageLoadFinishingAfterSendKeepsTheNewOutgoingMessage() = withScope { scope ->
        val loadStarted = CompletableDeferred<Unit>()
        val loadedMessages = CompletableDeferred<Result<List<DirectMessage>>>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(emptyList()),
            initialDraft = "",
        ).apply {
            messagesHandler = {
                loadStarted.complete(Unit)
                loadedMessages.await()
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        assertTrue("The initial conversation load should be waiting", loadStarted.isCompleted)

        model.onEvent(MessageConversationEvent.Send("A fictional new note"))

        assertEquals(listOf(sent), model.state.value.messages)
        loadedMessages.complete(Result.success(listOf(incoming)))

        assertEquals(listOf(sent, incoming), model.state.value.messages)
        assertTrue(model.state.value.messagesLoaded)
    }

    @Test
    fun messageLoadDoesNotDuplicateAnOutgoingMessageAlreadyReturnedByTheServer() = withScope { scope ->
        val loadStarted = CompletableDeferred<Unit>()
        val loadedMessages = CompletableDeferred<Result<List<DirectMessage>>>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(emptyList()),
            initialDraft = "",
        ).apply {
            messagesHandler = {
                loadStarted.complete(Unit)
                loadedMessages.await()
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        assertTrue("The initial conversation load should be waiting", loadStarted.isCompleted)

        model.onEvent(MessageConversationEvent.Send("A fictional new note"))
        loadedMessages.complete(Result.success(listOf(sent, incoming)))

        assertEquals(listOf(sent, incoming), model.state.value.messages)
    }

    @Test
    fun refreshedMessagesReplaceOldMessagesButKeepMessagesSentDuringTheRefresh() = withScope { scope ->
        val oldMessage = DirectMessage("old-message", "A fictional old note", member)
        val refreshStarted = CompletableDeferred<Unit>()
        val refreshedMessages = CompletableDeferred<Result<List<DirectMessage>>>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(listOf(oldMessage)),
            initialDraft = "",
        ).apply {
            messagesHandler = {
                if (messageLookups.size == 1) Result.success(listOf(oldMessage))
                else {
                    refreshStarted.complete(Unit)
                    refreshedMessages.await()
                }
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        assertEquals(listOf(oldMessage), model.state.value.messages)

        model.onEvent(MessageConversationEvent.Retry)
        assertTrue("The refresh should be waiting", refreshStarted.isCompleted)
        model.onEvent(MessageConversationEvent.Send("A fictional new note"))
        refreshedMessages.complete(Result.success(listOf(incoming)))

        assertEquals(listOf(sent, incoming), model.state.value.messages)
    }

    @Test
    fun missingRecipientCanRetryWithoutReadingInboxState() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.failure(MobileApiException(404, "Fictional member unavailable.")),
            messagesResult = Result.success(emptyList()),
            initialDraft = "",
        )
        val model = MessageConversationViewModel("missing-member", repository, session(), scope)
        assertTrue(model.state.value.loadFailed)
        assertNull(model.state.value.member)
        assertEquals("Fictional member unavailable.", model.state.value.failure?.serverMessage)

        repository.memberResult = Result.success(member)
        model.onEvent(MessageConversationEvent.Retry)

        assertEquals(listOf("missing-member", "missing-member"), repository.memberLookups)
        assertEquals(listOf("missing-member"), repository.messageLookups)
        assertTrue(model.state.value.messagesLoaded)
        assertFalse(model.state.value.loadFailed)
    }

    @Test
    fun messageLoadFailureKeepsRecipientAndRetryRestoresQuickReply() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(listOf(incoming)),
            initialDraft = "A fictional saved draft",
        ).apply {
            messagesHandler = {
                if (messageLookups.size == 1) Result.failure(IOException("A fictional conversation outage."))
                else Result.success(listOf(incoming))
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)

        assertEquals(member, model.state.value.member)
        assertTrue(model.state.value.loadFailed)
        assertFalse(model.state.value.showQuickReply)
        assertEquals("A fictional saved draft", model.state.value.draft)

        model.onEvent(MessageConversationEvent.Retry)

        assertEquals(2, repository.messageLookups.size)
        assertTrue(model.state.value.messagesLoaded)
        assertFalse(model.state.value.loadFailed)
        assertTrue(model.state.value.showQuickReply)
    }

    @Test
    fun thrownMessageLoadFailureKeepsRecipientAndCanBeRetried() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(listOf(incoming)),
            initialDraft = "A fictional saved draft",
        ).apply {
            messagesHandler = {
                if (messageLookups.size == 1) throw IOException("A fictional conversation outage.")
                Result.success(listOf(incoming))
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)

        assertEquals(member, model.state.value.member)
        assertEquals("A fictional saved draft", model.state.value.draft)
        assertTrue(model.state.value.loadFailed)
        assertEquals(UiFailureFallback.LOAD_CONVERSATION, model.state.value.failure?.fallback)

        model.onEvent(MessageConversationEvent.Retry)

        assertEquals(2, repository.messageLookups.size)
        assertTrue(model.state.value.messagesLoaded)
        assertFalse(model.state.value.loadFailed)
        assertEquals(listOf(incoming), model.state.value.messages)
    }

    @Test
    fun recipientAuthenticationFailureWaitsForRenewedSessionBeforeRetrying() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(listOf(incoming)),
            initialDraft = "",
        ).apply {
            memberHandler = {
                if (memberLookups.size == 1) {
                    Result.failure(MobileApiException(401, "Fictional session expired."))
                } else {
                    Result.success(member)
                }
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)

        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)
        assertEquals(1, repository.memberLookups.size)
        assertTrue(repository.messageLookups.isEmpty())
        model.onEvent(MessageConversationEvent.Retry)
        assertEquals(1, repository.memberLookups.size)
        model.onEvent(MessageConversationEvent.SessionInvalidationDelivered(pending.id))
        model.onEvent(MessageConversationEvent.Retry)
        assertEquals(1, repository.memberLookups.size)

        model.onEvent(MessageConversationEvent.SessionChanged(session("connect.sid=renewed-fictional-session")))

        assertEquals(2, repository.memberLookups.size)
        assertEquals(1, repository.messageLookups.size)
        assertNull(model.state.value.pendingSessionInvalidation)
        assertTrue(model.state.value.messagesLoaded)
        assertFalse(model.state.value.loadFailed)
    }

    @Test
    fun reentrantCredentialRefreshDuringRecipientLoadRejectsTheOldResponse() = withScope { scope ->
        lateinit var model: MessageConversationViewModel
        val repository = FakeConversationRepository(
            memberResult = Result.success(member),
            messagesResult = Result.success(listOf(incoming)),
            initialDraft = "",
        )
        var memberCalls = 0
        repository.memberHandler = {
            if (++memberCalls == 2) {
                model.onEvent(MessageConversationEvent.SessionChanged(session("connect.sid=renewed-session")))
            }
            Result.success(member)
        }
        model = MessageConversationViewModel("member-owl", repository, session(), scope)

        model.onEvent(MessageConversationEvent.Retry)

        assertEquals(listOf("member-owl", "member-owl", "member-owl"), repository.memberLookups)
        assertEquals(listOf("member-owl", "member-owl"), repository.messageLookups)
        assertEquals("steady-heron", model.state.value.currentUsername)
        assertEquals(listOf(incoming), model.state.value.messages)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun missingRecipientIdentityUsesRequestedIdForDraftsAndCannotBeSent() = withScope { scope ->
        val recipientWithoutIdentity = MessageMember(id = null, username = null, displayName = "Anonymous Member")
        val repository = FakeConversationRepository(
            memberResult = Result.success(recipientWithoutIdentity),
            messagesResult = Result.success(emptyList()),
            initialDraft = "A fictional saved draft",
        )
        val model = MessageConversationViewModel("requested-member-id", repository, session(), scope)

        assertEquals("requested-member-id", repository.loadedDraftKey)
        assertEquals("A fictional saved draft", model.state.value.draft)
        model.onEvent(MessageConversationEvent.DraftChanged("A draft for the unresolved recipient"))
        assertEquals("requested-member-id", repository.savedDraftKey)
        model.onEvent(MessageConversationEvent.Send("   "))
        model.onEvent(MessageConversationEvent.Send("A message that must not be sent without a recipient ID"))

        assertNull(repository.sentContent)
        assertNull(repository.clearedDraftKey)
        assertFalse(model.state.value.isSending)
    }

    @Test
    fun draftPersistsAndSuccessfulSendClearsTheSameAccountCounterpartKey() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)),
            initialDraft = "",
        )
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)

        model.onEvent(MessageConversationEvent.DraftChanged("  A new fictional note  "))
        assertEquals("  A new fictional note  ", repository.savedDraft)
        assertEquals("  A new fictional note  ", model.state.value.draft)
        model.onEvent(MessageConversationEvent.Send("  A new fictional note  "))

        assertEquals("A new fictional note", repository.sentContent)
        assertEquals("steady-heron" to "steady-owl", repository.clearedDraftKey)
        assertEquals("", model.state.value.draft)
        assertEquals("sent-message", model.state.value.messages.first().id)
        assertEquals("sent-message", model.state.value.lastSentMessageID)
        assertFalse(model.state.value.showQuickReply)
        assertFalse(model.state.value.isSending)
    }

    @Test
    fun quickReplyUsesTheUiSuppliedLocalizedPayload() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)), initialDraft = "",
        )
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        val localizedPayload = "<p>A fictional quick reply.</p>"

        model.onEvent(MessageConversationEvent.QuickReply(localizedPayload))

        assertEquals(localizedPayload, repository.sentContent)
    }

    @Test
    fun duplicateSendAndRetryAreIgnoredWhileSendIsPendingAndThrownErrorKeepsDraft() = withScope { scope ->
        val pending = CompletableDeferred<Unit>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)), initialDraft = "",
        ).apply {
            sendHandler = { _, _ ->
                pending.await()
                throw IOException("A fictional send outage.")
            }
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        model.onEvent(MessageConversationEvent.DraftChanged("Keep this note"))
        model.onEvent(MessageConversationEvent.Send("Keep this note"))
        model.onEvent(MessageConversationEvent.Send("A duplicate"))
        model.onEvent(MessageConversationEvent.Retry)

        assertTrue(model.state.value.isSending)
        assertEquals(1, repository.sendCalls)
        assertEquals(1, repository.memberLookups.size)
        pending.complete(Unit)

        assertFalse(model.state.value.isSending)
        assertEquals(UiFailureFallback.SEND_MESSAGE, model.state.value.failure?.fallback)
        assertEquals("Keep this note", model.state.value.draft)
        assertEquals(null, model.state.value.lastSentMessageID)
        assertEquals(1, repository.sendCalls)
    }

    @Test
    fun recipientIDIsUsedForDraftAndClearWhenUsernameIsUnavailable() = withScope { scope ->
        val recipient = MessageMember(id = "recipient-without-username", username = null, displayName = "Anonymous Recipient")
        val repository = FakeConversationRepository(
            memberResult = Result.success(recipient), messagesResult = Result.success(emptyList()),
            initialDraft = "A saved note",
        )
        val model = MessageConversationViewModel("requested-id", repository, session(), scope)

        assertEquals("recipient-without-username", repository.loadedDraftKey)
        model.onEvent(MessageConversationEvent.Send("A new note"))

        assertEquals("A new note", repository.sentContent)
        assertEquals("steady-heron" to "recipient-without-username", repository.clearedDraftKey)
        assertEquals("sent-message", model.state.value.messages.first().id)
    }

    @Test
    fun failedSendKeepsDraftAndAuthenticationInvalidationIsAcknowledgedOnce() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)),
            initialDraft = "",
            sendResult = Result.failure(MobileApiException(401, "Fictional session expired.")),
        )
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        model.onEvent(MessageConversationEvent.DraftChanged("Keep this fictional note"))
        model.onEvent(MessageConversationEvent.Send("Keep this fictional note"))

        val pending = requireNotNull(model.state.value.pendingSessionInvalidation)
        assertEquals("Keep this fictional note", model.state.value.draft)
        model.onEvent(MessageConversationEvent.SessionInvalidationDelivered(pending.id + 1))
        assertEquals(pending, model.state.value.pendingSessionInvalidation)
        model.onEvent(MessageConversationEvent.SessionInvalidationDelivered(pending.id))
        assertNull(model.state.value.pendingSessionInvalidation)
        model.onEvent(MessageConversationEvent.Send("A second note after session expiry"))
        assertEquals(1, repository.sendCalls)
        assertEquals("Keep this fictional note", model.state.value.draft)
        model.onEvent(MessageConversationEvent.Retry)
        assertEquals(1, repository.memberLookups.size)
    }

    @Test
    fun renewingCredentialsReloadsAndDoesNotExposeCookieInState() = withScope { scope ->
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)),
            initialDraft = "",
        )
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)

        model.onEvent(MessageConversationEvent.SessionChanged(session("connect.sid=renewed-fictional-session")))

        assertEquals(2, repository.memberLookups.size)
        assertEquals(2, repository.messageLookups.size)
        assertFalse(model.state.value.toString().contains("renewed-fictional-session"))
    }

    @Test
    fun clearingConversationEntryCancelsItsLoadAndClearsEntryState() = withScope { scope ->
        val waiting = CompletableDeferred<Result<MessageMember>>()
        val cancelled = CompletableDeferred<Unit>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(emptyList()), initialDraft = "",
        )
        repository.memberHandler = {
            try {
                waiting.await()
            } finally {
                cancelled.complete(Unit)
            }
        }
        val store = ViewModelStore()
        val model = ViewModelProvider(
            StoreOwner(store),
            MessageConversationViewModelFactoryForTest("member-owl", repository, session(), scope),
        )[MessageConversationViewModel::class.java]
        assertTrue(model.state.value.isLoading)

        store.clear()

        assertTrue("Clearing the Navigation 3 entry cancels its load", cancelled.isCompleted)
        assertEquals(MessageConversationUiState(isLoading = false), model.state.value)
        waiting.complete(Result.success(member))
        assertEquals(MessageConversationUiState(isLoading = false), model.state.value)
    }

    @Test
    fun clearingConversationEntryCancelsItsSendAndClearsDraftAndMessages() = withScope { scope ->
        val sendStarted = CompletableDeferred<Unit>()
        val sendCancelled = CompletableDeferred<Unit>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)), initialDraft = "",
        )
        repository.sendHandler = { _, _ ->
            sendStarted.complete(Unit)
            try {
                CompletableDeferred<Result<DirectMessage>>().await()
            } finally {
                sendCancelled.complete(Unit)
            }
        }
        val store = ViewModelStore()
        val model = ViewModelProvider(
            StoreOwner(store),
            MessageConversationViewModelFactoryForTest("member-owl", repository, session(), scope),
        )[MessageConversationViewModel::class.java]
        model.onEvent(MessageConversationEvent.DraftChanged("A fictional unsent note"))
        model.onEvent(MessageConversationEvent.Send("A fictional unsent note"))
        assertTrue(sendStarted.isCompleted)
        assertTrue(model.state.value.isSending)

        store.clear()

        assertTrue("Clearing the Navigation 3 entry cancels its send", sendCancelled.isCompleted)
        assertEquals(MessageConversationUiState(isLoading = false), model.state.value)
        assertEquals("A fictional unsent note", repository.savedDraft)
        assertNull(repository.clearedDraftKey)
    }

    @Test
    fun lateSendFromPreviousCredentialsCannotClearTheRetainedDraftOrReplaceMessages() = withScope { scope ->
        val lateSend = CompletableDeferred<Result<DirectMessage>>()
        var sendCalls = 0
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)), initialDraft = "",
        )
        repository.sendHandler = { _, _ ->
            sendCalls++
            if (sendCalls == 1) withContext(NonCancellable) { lateSend.await() }
            else Result.success(sent)
        }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        model.onEvent(MessageConversationEvent.DraftChanged("Keep this fictional note"))
        model.onEvent(MessageConversationEvent.Send("Keep this fictional note"))
        assertTrue(model.state.value.isSending)

        model.onEvent(MessageConversationEvent.SessionChanged(session("connect.sid=renewed-fictional-session")))
        assertEquals("Keep this fictional note", model.state.value.draft)
        assertFalse(model.state.value.isSending)
        lateSend.complete(Result.success(DirectMessage("stale-send", "Stale fictional note", member)))

        assertEquals(listOf(incoming), model.state.value.messages)
        assertEquals("Keep this fictional note", model.state.value.draft)
        assertNull(repository.clearedDraftKey)
    }

    @Test
    fun lateSendFromPreviousBackendCannotChangeTheCurrentConversation() = withScope { scope ->
        val lateSend = CompletableDeferred<Result<DirectMessage>>()
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)),
            initialDraft = "", currentApi = MobileApiClient("https://first.example.test"),
        )
        repository.sendHandler = { _, _ -> withContext(NonCancellable) { lateSend.await() } }
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        model.onEvent(MessageConversationEvent.DraftChanged("A draft for the current backend"))
        model.onEvent(MessageConversationEvent.Send("A draft for the current backend"))

        val replacementApi = MobileApiClient("https://second.example.test")
        model.updateApi(replacementApi)
        assertSame(replacementApi, repository.currentApi)
        assertEquals("A draft for the current backend", model.state.value.draft)
        lateSend.complete(Result.success(DirectMessage("old-backend-send", "Stale note", member)))

        assertEquals(listOf(incoming), model.state.value.messages)
        assertEquals("A draft for the current backend", model.state.value.draft)
        assertNull(repository.clearedDraftKey)
    }

    @Test
    fun sameNormalizedBackendReplacesTheApiWithoutReloadingButDifferentBackendReloads() = withScope { scope ->
        val originalApi = MobileApiClient("https://messages.example.test")
        val repository = FakeConversationRepository(
            memberResult = Result.success(member), messagesResult = Result.success(listOf(incoming)),
            initialDraft = "", currentApi = originalApi,
        )
        val model = MessageConversationViewModel("member-owl", repository, session(), scope)
        val sameBackendApi = MobileApiClient("https://messages.example.test/")

        model.updateApi(sameBackendApi)

        assertSame(sameBackendApi, repository.currentApi)
        assertEquals(listOf("member-owl"), repository.memberLookups)
        assertEquals(listOf("member-owl"), repository.messageLookups)

        val otherBackendApi = MobileApiClient("https://other-messages.example.test")
        model.updateApi(otherBackendApi)

        assertSame(otherBackendApi, repository.currentApi)
        assertEquals(listOf("member-owl", "member-owl"), repository.memberLookups)
        assertEquals(listOf("member-owl", "member-owl"), repository.messageLookups)
    }

    @Test
    fun mobileRepositoryComparesNormalizedBackendIdentity() {
        val context = RuntimeEnvironment.getApplication() as Context
        val originalSession = session()
        val repository = MobileApiMessageConversationRepository(
            MobileApiClient("https://messages.example.test/"), originalSession, context,
        )

        assertFalse(repository.updateApi(MobileApiClient("https://messages.example.test")))
        assertTrue(repository.updateApi(MobileApiClient("https://other-messages.example.test")))
        assertFalse(repository.updateSession(originalSession))
        assertTrue(repository.updateSession(session("connect.sid=renewed-fictional-session")))
        assertTrue(
            repository.updateSession(
                MemberSession("connect.sid=renewed-fictional-session", MobileMember("calm-lynx", "Calm Lynx")),
            ),
        )
        assertFalse(
            repository.updateSession(
                MemberSession("connect.sid=renewed-fictional-session", MobileMember("calm-lynx", "Calm Lynx")),
            ),
        )
    }

    private class FakeConversationRepository(
        var memberResult: Result<MessageMember>,
        private val messagesResult: Result<List<DirectMessage>>,
        private val initialDraft: String,
        private val sendResult: Result<DirectMessage> = Result.success(sent),
        var currentApi: MobileApiClient? = null,
    ) : MessageConversationRepository {
        val memberLookups = mutableListOf<String>()
        val messageLookups = mutableListOf<String>()
        var loadedDraftKey: String? = null
        var savedDraftKey: String? = null
        var savedDraftValue: String? = null
        val savedDraft get() = savedDraftValue ?: initialDraft
        var clearedDraftKey: Pair<String, String>? = null
        var sentContent: String? = null
        var sendCalls = 0
        var memberHandler: suspend (String) -> Result<MessageMember> = { memberResult }
        var messagesHandler: suspend (String) -> Result<List<DirectMessage>> = { messagesResult }
        var sendHandler: suspend (String, String) -> Result<DirectMessage> = { _, _ -> sendResult }

        override fun updateApi(api: MobileApiClient): Boolean {
            val changed = currentApi?.backendURL?.let { it != api.backendURL } ?: false
            currentApi = api
            return changed
        }

        override suspend fun member(memberID: String): Result<MessageMember> {
            memberLookups += memberID
            return memberHandler(memberID)
        }

        override suspend fun messages(memberID: String): Result<List<DirectMessage>> {
            messageLookups += memberID
            return messagesHandler(memberID)
        }

        override suspend fun send(memberID: String, content: String): Result<DirectMessage> {
            sentContent = content
            sendCalls++
            return sendHandler(memberID, content)
        }

        override fun loadDraft(selfUsername: String, otherKey: String): String {
            loadedDraftKey = otherKey
            return savedDraft
        }

        override fun saveDraft(selfUsername: String, otherKey: String, value: String) {
            savedDraftKey = otherKey
            savedDraftValue = value
        }

        override fun clearDraft(selfUsername: String, otherKey: String) {
            clearedDraftKey = selfUsername to otherKey
            savedDraftValue = ""
        }
    }

    private class StoreOwner(override val viewModelStore: ViewModelStore) : ViewModelStoreOwner

    private class MessageConversationViewModelFactoryForTest(
        private val memberID: String,
        private val repository: MessageConversationRepository,
        private val session: MemberSession,
        private val scope: CoroutineScope,
    ) : androidx.lifecycle.ViewModelProvider.Factory {
        override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(MessageConversationViewModel::class.java))
            @Suppress("UNCHECKED_CAST")
            return MessageConversationViewModel(memberID, repository, session, scope) as T
        }
    }

    private fun withScope(block: (CoroutineScope) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try { block(scope) } finally { scope.cancel() }
    }

    private fun session(cookie: String = "connect.sid=fictional-session") =
        MemberSession(cookie, MobileMember("steady-heron", "Steady Heron"))

    private companion object {
        val member = MessageMember("member-owl", "steady-owl", "Steady Owl")
        val incoming = DirectMessage("incoming-message", "A fictional incoming note", member)
        val sent = DirectMessage("sent-message", "A fictional sent note", MessageMember("self", "steady-heron", "Steady Heron"))
    }
}
