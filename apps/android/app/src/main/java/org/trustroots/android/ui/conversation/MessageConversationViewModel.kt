package org.trustroots.android.ui.conversation

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.ConversationRecipient
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.HostingContext
import org.trustroots.android.api.HostingDetails
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.hostingDetailsValidationMessage
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.toUiFailure

internal interface MessageConversationRepository {
    fun updateSession(session: MemberSession): Boolean = false
    fun updateApi(api: MobileApiClient): Boolean = false
    suspend fun member(memberID: String): Result<ConversationRecipient>
    suspend fun messages(memberID: String): Result<List<DirectMessage>>
    suspend fun hostingContext(memberID: String): Result<HostingContext> =
        Result.failure(UnsupportedOperationException("Hosting context is unavailable."))
    suspend fun send(memberID: String, content: String): Result<DirectMessage>
    suspend fun send(
        memberID: String,
        content: String,
        hostingDetails: HostingDetails?,
        hostingDescriptionAcknowledged: Boolean,
    ): Result<DirectMessage> = send(memberID, content)
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
        val changed = this.session.credentialKey != session.credentialKey ||
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
    override suspend fun hostingContext(memberID: String) = api.hostingContext(session, memberID)
    override suspend fun send(memberID: String, content: String) = api.sendMessage(session, memberID, content)
    override suspend fun send(
        memberID: String,
        content: String,
        hostingDetails: HostingDetails?,
        hostingDescriptionAcknowledged: Boolean,
    ) = api.sendMessage(session, memberID, content, hostingDetails, hostingDescriptionAcknowledged)
    override fun loadDraft(selfUsername: String, otherKey: String) = drafts.load(selfUsername, otherKey)
    override fun saveDraft(selfUsername: String, otherKey: String, value: String) =
        drafts.save(selfUsername, otherKey, value)
    override fun clearDraft(selfUsername: String, otherKey: String) = drafts.clear(selfUsername, otherKey)
}

internal data class ConversationSessionInvalidation(val id: Long)

internal data class MessageConversationUiState(
    val member: ConversationRecipient? = null,
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
    val hostingMode: Boolean = false,
    val hostingDescription: String = "",
    val hostingContextLoaded: Boolean = false,
    val hostingContextLoading: Boolean = false,
    val hostingContextError: Boolean = false,
    val hostingAckRequired: Boolean = false,
    val hostingDescriptionAcknowledged: Boolean = false,
    val hostingGuests: String = "1",
    val hostingArrival: String = "",
    val hostingDeparture: String = "",
    val hostingAcknowledgementStale: Boolean = false,
) {
    val showQuickReply: Boolean
        get() {
            if (!messagesLoaded || loadFailed || failure != null) return false
            return messages
                .takeWhile { it.sender.username != currentUsername }
                .any { it.hostingDetails != null }
        }
    val hostingDetailsError: String?
        get() = hostingDetailsValidationMessage(hostingGuests, hostingArrival, hostingDeparture)
    val hostingComposerReady: Boolean
        get() = hostingContextLoaded && !hostingContextLoading && !hostingContextError &&
            (!hostingAckRequired || hostingDescriptionAcknowledged) && hostingDetailsError == null
}

internal sealed interface MessageConversationEvent {
    data object Retry : MessageConversationEvent
    data class DraftChanged(val value: String) : MessageConversationEvent
    data class Send(val content: String) : MessageConversationEvent
    data class QuickReply(val content: String) : MessageConversationEvent
    data class HostingModeChanged(val enabled: Boolean) : MessageConversationEvent
    data object RetryHostingContext : MessageConversationEvent
    data class HostingAcknowledgementChanged(val acknowledged: Boolean) : MessageConversationEvent
    data class HostingGuestsChanged(val value: String) : MessageConversationEvent
    data class HostingArrivalChanged(val value: String) : MessageConversationEvent
    data class HostingDepartureChanged(val value: String) : MessageConversationEvent
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
    private val loadRequest = LatestRequest(requestScope)
    private val sendRequest = LatestRequest(requestScope)
    private val hostingRequest = LatestRequest(requestScope)
    private val mutableState = MutableStateFlow(
        MessageConversationUiState(currentUsername = initialSession.member.username),
    )
    val state = mutableState.asStateFlow()

    private var session = initialSession
    private var invalidationID = 0L
    private var invalidationEmitted = false

    init { load() }

    fun onEvent(event: MessageConversationEvent) {
        when (event) {
            MessageConversationEvent.Retry -> if (!mutableState.value.isSending) load()
            is MessageConversationEvent.DraftChanged -> updateDraft(event.value)
            is MessageConversationEvent.Send -> send(event.content)
            is MessageConversationEvent.QuickReply -> send(event.content, includeHostingDetails = false)
            is MessageConversationEvent.HostingModeChanged -> setHostingMode(event.enabled)
            MessageConversationEvent.RetryHostingContext -> loadHostingContext()
            is MessageConversationEvent.HostingAcknowledgementChanged -> mutableState.update {
                it.copy(hostingDescriptionAcknowledged = event.acknowledged, hostingAcknowledgementStale = false)
            }
            is MessageConversationEvent.HostingGuestsChanged -> mutableState.update {
                it.copy(hostingGuests = event.value.filter(Char::isDigit).take(3))
            }
            is MessageConversationEvent.HostingArrivalChanged -> mutableState.update { it.copy(hostingArrival = event.value) }
            is MessageConversationEvent.HostingDepartureChanged -> mutableState.update { it.copy(hostingDeparture = event.value) }
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
        if (session.credentialKey == value.credentialKey && session.member.username == value.member.username) return
        session = value
        repository.updateSession(value)
        refreshForEnvironmentChange()
    }

    private fun refreshForEnvironmentChange() {
        loadRequest.cancel()
        sendRequest.cancel()
        hostingRequest.cancel()
        invalidationEmitted = false
        mutableState.value = MessageConversationUiState(currentUsername = session.member.username)
        load()
    }

    private fun updateDraft(value: String) {
        val member = mutableState.value.member ?: return
        val draftKey = member.username ?: member.id
        mutableState.update { it.copy(draft = value) }
        repository.saveDraft(session.member.username, draftKey, value)
    }

    private fun setHostingMode(enabled: Boolean) {
        mutableState.update {
            it.copy(
                hostingMode = enabled,
                hostingDescriptionAcknowledged = false,
                hostingAcknowledgementStale = false,
            )
        }
        if (enabled && !mutableState.value.hostingContextLoaded) loadHostingContext()
    }

    private fun loadHostingContext() {
        val member = mutableState.value.member ?: return
        if (mutableState.value.hostingContextLoading) return
        hostingRequest.launch {
            mutableState.update { it.copy(hostingContextLoading = true, hostingContextError = false) }
            val result = requestResult { repository.hostingContext(member.id) }
            val error = result.exceptionOrNull()
            if (error != null) {
                if (error.isAuthenticationFailure()) emitSessionInvalidation()
                else mutableState.update { it.copy(hostingContextLoading = false, hostingContextError = true) }
            } else {
                val context = result.getOrThrow()
                mutableState.update {
                    it.copy(
                        hostingDescription = context.description,
                        hostingAckRequired = context.acknowledgementRequired,
                        hostingContextLoaded = true,
                        hostingContextLoading = false,
                        hostingContextError = false,
                    )
                }
            }
        }
    }

    private fun load() {
        if (invalidationEmitted) return
        loadRequest.launch {
            val messageIDsAtLoadStart = mutableState.value.messages.mapTo(mutableSetOf()) { it.id }
            mutableState.update { it.copy(isLoading = true, messagesLoaded = false, loadFailed = false, failure = null, pendingSessionInvalidation = null) }
            currentCoroutineContext().ensureActive()
            val memberResult = requestResult { repository.member(memberID) }
            val memberError = memberResult.exceptionOrNull()
            if (memberError != null) {
                fail(memberError, UiFailureFallback.LOAD_CONVERSATION)
                return@launch
            }
            val member = memberResult.getOrThrow()
            val draftKey = member.username ?: member.id
            val draft = repository.loadDraft(session.member.username, draftKey)
            currentCoroutineContext().ensureActive()
            mutableState.update { it.copy(member = member, draft = draft) }
            currentCoroutineContext().ensureActive()
            val messageResult = requestResult { repository.messages(memberID) }
            val error = messageResult.exceptionOrNull()
            if (error != null) {
                fail(error, UiFailureFallback.LOAD_CONVERSATION)
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

    private fun send(content: String, includeHostingDetails: Boolean = true) {
        val current = mutableState.value
        val member = current.member ?: return
        val trimmed = content.trim()
        if (trimmed.isBlank() || current.isSending || invalidationEmitted) return
        val attachHostingDetails = includeHostingDetails && current.hostingMode
        if (attachHostingDetails && !current.hostingComposerReady) return
        sendRequest.launch {
            mutableState.update { it.copy(isSending = true, failure = null) }
            currentCoroutineContext().ensureActive()
            val details = if (attachHostingDetails) HostingDetails(
                guests = current.hostingGuests.toInt(),
                arrival = current.hostingArrival.trim().takeIf { it.isNotBlank() },
                departure = current.hostingDeparture.trim().takeIf { it.isNotBlank() },
            ) else null
            val result = requestResult {
                repository.send(
                    member.id,
                    trimmed,
                    details,
                    attachHostingDetails && current.hostingDescriptionAcknowledged,
                )
            }
            val error = result.exceptionOrNull()
            if (error != null) {
                if (error.isAuthenticationFailure()) emitSessionInvalidation()
                else if ((error as? MobileApiException)?.code == "hosting-description-acknowledgement-required") {
                    mutableState.update {
                        it.copy(
                            isSending = false,
                            hostingDescriptionAcknowledged = false,
                            hostingContextLoaded = false,
                            hostingContextError = false,
                            hostingAcknowledgementStale = true,
                        )
                    }
                    loadHostingContext()
                } else {
                    mutableState.update { it.copy(isSending = false, failure = error.toUiFailure(UiFailureFallback.SEND_MESSAGE)) }
                }
            } else {
                repository.clearDraft(session.member.username, member.username ?: member.id)
                currentCoroutineContext().ensureActive()
                mutableState.update {
                    val message = result.getOrThrow()
                    it.copy(
                        messages = listOf(message) + it.messages,
                        draft = "",
                        isSending = false,
                        lastSentMessageID = message.id,
                        failure = null,
                        hostingMode = false,
                        hostingDescription = "",
                        hostingContextLoaded = false,
                        hostingContextError = false,
                        hostingAckRequired = false,
                        hostingDescriptionAcknowledged = false,
                        hostingGuests = "1",
                        hostingArrival = "",
                        hostingDeparture = "",
                        hostingAcknowledgementStale = false,
                    )
                }
            }
        }
    }

    private suspend fun fail(error: Throwable, fallback: UiFailureFallback) {
        if (error.isAuthenticationFailure()) emitSessionInvalidation()
        else mutableState.update {
            it.copy(isLoading = false, messagesLoaded = true, loadFailed = true, failure = error.toUiFailure(fallback))
        }
    }

    private suspend fun emitSessionInvalidation() {
        currentCoroutineContext().ensureActive()
        if (invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update {
            it.copy(isLoading = false, messagesLoaded = true, loadFailed = false, isSending = false,
                pendingSessionInvalidation = ConversationSessionInvalidation(++invalidationID))
        }
    }


    override fun onCleared() {
        loadRequest.cancel()
        sendRequest.cancel()
        hostingRequest.cancel()
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

internal class MessageConversationViewModelFactory(
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
