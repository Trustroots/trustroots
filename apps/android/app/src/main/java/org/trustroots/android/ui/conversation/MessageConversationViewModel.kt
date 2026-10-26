package org.trustroots.android.ui.conversation

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.toUiFailure

internal interface MessageConversationRepository {
    fun updateSession(session: MemberSession): Boolean = false
    fun updateApi(api: MobileApiClient): Boolean = false
    suspend fun member(memberID: String): Result<MessageMember>
    suspend fun messages(memberID: String): Result<List<DirectMessage>>
    suspend fun send(memberID: String, content: String): Result<DirectMessage>
    fun loadDraft(selfUsername: String, otherKey: String): String
    fun saveDraft(selfUsername: String, otherKey: String, value: String)
    fun clearDraft(selfUsername: String, otherKey: String)
}

internal class MobileApiMessageConversationRepository(
    api: MobileApiClient,
    session: MemberSession,
    context: Context,
) : MessageConversationRepository {
    private var api = api
    private var session = session
    private val drafts = MessageDraftStore(context.applicationContext)

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override fun updateApi(api: MobileApiClient): Boolean {
        val changed = this.api.backendURL != api.backendURL
        this.api = api
        return changed
    }

    override suspend fun member(memberID: String) = api.messageMember(session, memberID)
    override suspend fun messages(memberID: String) = api.conversation(session, memberID)
    override suspend fun send(memberID: String, content: String) = api.sendMessage(session, memberID, content)
    override fun loadDraft(selfUsername: String, otherKey: String) = drafts.load(selfUsername, otherKey)
    override fun saveDraft(selfUsername: String, otherKey: String, value: String) =
        drafts.save(selfUsername, otherKey, value)
    override fun clearDraft(selfUsername: String, otherKey: String) = drafts.clear(selfUsername, otherKey)
}

internal data class ConversationSessionInvalidation(val id: Long)

internal data class MessageConversationUiState(
    val member: MessageMember? = null,
    val messages: List<DirectMessage> = emptyList(),
    val draft: String = "",
    val isLoading: Boolean = true,
    val messagesLoaded: Boolean = false,
    val loadFailed: Boolean = false,
    val isSending: Boolean = false,
    val lastSentMessageID: String? = null,
    val failure: UiFailure? = null,
    val pendingSessionInvalidation: ConversationSessionInvalidation? = null,
    val currentUsername: String = "",
) {
    val showQuickReply: Boolean
        get() = messagesLoaded && !loadFailed && failure == null && messages.isNotEmpty() &&
            messages.none { it.sender.username == currentUsername }
}

internal sealed interface MessageConversationEvent {
    data object Retry : MessageConversationEvent
    data class DraftChanged(val value: String) : MessageConversationEvent
    data class Send(val content: String) : MessageConversationEvent
    data class QuickReply(val content: String) : MessageConversationEvent
    data class SessionChanged(val session: MemberSession) : MessageConversationEvent
    data class SessionInvalidationDelivered(val id: Long) : MessageConversationEvent
}

internal class MessageConversationViewModel(
    private val memberID: String,
    private val repository: MessageConversationRepository,
    initialSession: MemberSession,
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(
        MessageConversationUiState(currentUsername = initialSession.member.username),
    )
    val state = mutableState.asStateFlow()

    private var session = initialSession
    private var generation = 0L
    private var invalidationID = 0L
    private var invalidationEmitted = false
    private var loadJob: Job? = null
    private var sendJob: Job? = null

    init { load() }

    fun onEvent(event: MessageConversationEvent) {
        when (event) {
            MessageConversationEvent.Retry -> if (!mutableState.value.isSending) load(force = true)
            is MessageConversationEvent.DraftChanged -> updateDraft(event.value)
            is MessageConversationEvent.Send -> send(event.content)
            is MessageConversationEvent.QuickReply -> send(event.content)
            is MessageConversationEvent.SessionChanged -> updateSession(event.session)
            is MessageConversationEvent.SessionInvalidationDelivered -> mutableState.update {
                if (it.pendingSessionInvalidation?.id == event.id) it.copy(pendingSessionInvalidation = null) else it
            }
        }
    }

    fun updateApi(api: MobileApiClient) {
        if (repository.updateApi(api)) refreshForEnvironmentChange()
    }

    private fun updateSession(value: MemberSession) {
        if (session.cookieHeader == value.cookieHeader && session.member.username == value.member.username) return
        session = value
        repository.updateSession(value)
        refreshForEnvironmentChange()
    }

    private fun refreshForEnvironmentChange() {
        generation++
        loadJob?.cancel()
        sendJob?.cancel()
        invalidationEmitted = false
        mutableState.value = MessageConversationUiState(currentUsername = session.member.username)
        load()
    }

    private fun updateDraft(value: String) {
        val member = mutableState.value.member ?: return
        val draftKey = member.username ?: member.id ?: memberID
        mutableState.update { it.copy(draft = value) }
        repository.saveDraft(session.member.username, draftKey, value)
    }

    private fun load(force: Boolean = false) {
        if (invalidationEmitted || (!force && mutableState.value.messagesLoaded)) return
        val request = ++generation
        val messageIDsAtLoadStart = mutableState.value.messages.mapTo(mutableSetOf()) { it.id }
        loadJob?.cancel()
        mutableState.update { it.copy(isLoading = true, messagesLoaded = false, loadFailed = false, failure = null, pendingSessionInvalidation = null) }
        loadJob = requestScope.launch {
            val memberResult = requestResult { repository.member(memberID) }
            if (request != generation) return@launch
            val memberError = memberResult.exceptionOrNull()
            if (memberError != null) {
                fail(request, memberError, UiFailureFallback.LOAD_CONVERSATION)
                return@launch
            }
            val member = memberResult.getOrThrow()
            val draftKey = member.username ?: member.id ?: memberID
            mutableState.update { it.copy(member = member, draft = repository.loadDraft(session.member.username, draftKey)) }
            val messageResult = requestResult { repository.messages(memberID) }
            if (request != generation) return@launch
            val error = messageResult.exceptionOrNull()
            if (error != null) {
                fail(request, error, UiFailureFallback.LOAD_CONVERSATION)
            } else {
                val loadedMessages = messageResult.getOrThrow()
                mutableState.update {
                    val messagesAddedWhileLoading = it.messages.filterNot { message -> message.id in messageIDsAtLoadStart }
                    val addedIDs = messagesAddedWhileLoading.mapTo(mutableSetOf()) { message -> message.id }
                    it.copy(
                        messages = messagesAddedWhileLoading + loadedMessages.filterNot { message -> message.id in addedIDs },
                        isLoading = false,
                        messagesLoaded = true,
                        loadFailed = false,
                    )
                }
            }
        }
    }

    private fun send(content: String) {
        val current = mutableState.value
        val member = current.member ?: return
        val trimmed = content.trim()
        if (trimmed.isBlank() || current.isSending || member.id == null || invalidationEmitted) return
        val request = generation
        sendJob?.cancel()
        mutableState.update { it.copy(isSending = true, failure = null) }
        sendJob = requestScope.launch {
            val result = requestResult { repository.send(member.id, trimmed) }
            if (request != generation) return@launch
            val error = result.exceptionOrNull()
            if (error != null) {
                if (error.isAuthenticationFailure()) emitSessionInvalidation(request)
                else mutableState.update { it.copy(isSending = false, failure = error.toUiFailure(UiFailureFallback.SEND_MESSAGE)) }
            } else {
                repository.clearDraft(session.member.username, member.username ?: member.id)
                mutableState.update {
                    val message = result.getOrThrow()
                    it.copy(messages = listOf(message) + it.messages, draft = "", isSending = false,
                        lastSentMessageID = message.id, failure = null)
                }
            }
        }
    }

    private fun fail(request: Long, error: Throwable, fallback: UiFailureFallback) {
        if (error.isAuthenticationFailure()) emitSessionInvalidation(request)
        else mutableState.update {
            it.copy(isLoading = false, messagesLoaded = true, loadFailed = true, failure = error.toUiFailure(fallback))
        }
    }

    private fun emitSessionInvalidation(request: Long) {
        if (request != generation || invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update {
            it.copy(isLoading = false, messagesLoaded = true, loadFailed = false, isSending = false,
                pendingSessionInvalidation = ConversationSessionInvalidation(++invalidationID))
        }
    }


    override fun onCleared() {
        generation++
        loadJob?.cancel()
        sendJob?.cancel()
        loadJob = null
        sendJob = null
        mutableState.value = MessageConversationUiState(isLoading = false)
        super.onCleared()
    }
}

internal fun ViewModelStoreOwner.messageConversationViewModel(
    memberID: String,
    api: MobileApiClient,
    session: MemberSession,
    context: Context,
): MessageConversationViewModel = ViewModelProvider(this, MessageConversationViewModelFactory(
    memberID, MobileApiMessageConversationRepository(api, session, context), session,
)).get(MessageConversationViewModel::class.java)

private class MessageConversationViewModelFactory(
    private val memberID: String,
    private val repository: MessageConversationRepository,
    private val session: MemberSession,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(MessageConversationViewModel::class.java))
        @Suppress("UNCHECKED_CAST")
        return MessageConversationViewModel(memberID, repository, session) as T
    }
}
