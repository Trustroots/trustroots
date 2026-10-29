package org.trustroots.android.ui.contacts

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.runtime.Composable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.requestResult

internal interface ContactsRepository {
    /** Replaces request dependencies; true means the backend or signed-in account changed. */
    fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean
    suspend fun profile(username: String): Result<MemberProfile>
    suspend fun contacts(memberID: String): Result<List<ProfileContact>>
}

/** Keeps the live API client and session in memory for the owning entry only. */
internal class MobileApiContactsRepository(
    private var api: MobileApiClient,
    private var session: MemberSession,
) : ContactsRepository {
    override fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean {
        val changed = this.api.backendURL != api.backendURL ||
            this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.api = api
        this.session = session
        return changed
    }

    override suspend fun profile(username: String): Result<MemberProfile> =
        api.profile(session, username)

    override suspend fun contacts(memberID: String): Result<List<ProfileContact>> =
        api.contacts(session, memberID)
}

internal enum class ContactsFailureReason {
    PROFILE,
    CONTACTS,
    MISSING_MEMBER_ID,
}

/** Failure identity and exception metadata remain separate from localized UI copy. */
internal data class ContactsFailure(
    val reason: ContactsFailureReason,
    val throwableType: String? = null,
    val serverMessage: String? = null,
    val apiKind: ApiFailureKind? = null,
)

internal data class ContactsSessionInvalidation(val id: Long)

internal data class ContactsUiState(
    val contacts: List<ProfileContact> = emptyList(),
    val isLoading: Boolean = false,
    val hasAttemptedLoad: Boolean = false,
    val isSessionInvalidated: Boolean = false,
    val failure: ContactsFailure? = null,
    val pendingSessionInvalidation: ContactsSessionInvalidation? = null,
)

internal sealed interface ContactsEvent {
    data object Retry : ContactsEvent
    data class SessionInvalidationDelivered(val id: Long) : ContactsEvent
}

internal class ContactsViewModel(
    private val username: String,
    private val repository: ContactsRepository,
    scope: CoroutineScope?,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(ContactsUiState())
    val state = mutableState.asStateFlow()

    private val request = LatestRequest(requestScope)
    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false

    init {
        load()
    }

    fun onEvent(event: ContactsEvent) {
        when (event) {
            ContactsEvent.Retry -> load()
            is ContactsEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        if (!repository.updateEnvironment(api, session)) return
        sessionInvalidationEmitted = false
        load(resetState = true)
    }

    private fun load(resetState: Boolean = false) {
        val current = mutableState.value
        if (sessionInvalidationEmitted || (current.isLoading && !resetState)) return

        request.launch {
            if (resetState) mutableState.value = ContactsUiState()
            currentCoroutineContext().ensureActive()
            mutableState.update { it.copy(isLoading = true, failure = null) }
            currentCoroutineContext().ensureActive()
            val profileResult = requestResult { repository.profile(username) }
            val profileFailure = profileResult.exceptionOrNull()
            if (profileFailure != null) {
                finishFailure(ContactsFailureReason.PROFILE, profileFailure)
                return@launch
            }
            val memberID = profileResult.getOrThrow().id
            if (memberID == null) {
                finishFailure(ContactsFailureReason.MISSING_MEMBER_ID, null)
                return@launch
            }

            val contactsResult = requestResult { repository.contacts(memberID) }
            val contactsFailure = contactsResult.exceptionOrNull()
            if (contactsFailure != null) {
                finishFailure(ContactsFailureReason.CONTACTS, contactsFailure)
                return@launch
            }
            mutableState.update {
                it.copy(
                    contacts = contactsResult.getOrThrow().toList(),
                    isLoading = false,
                    hasAttemptedLoad = true,
                    failure = null,
                )
            }
        }
    }

    private suspend fun finishFailure(reason: ContactsFailureReason, error: Throwable?) {
        currentCoroutineContext().ensureActive()
        if (error?.isAuthenticationFailure() == true) {
            emitSessionInvalidation()
            currentCoroutineContext().ensureActive()
            mutableState.update { it.copy(isLoading = false, hasAttemptedLoad = true) }
            return
        }
        mutableState.update {
            it.copy(
                isLoading = false,
                hasAttemptedLoad = true,
                failure = ContactsFailure(
                    reason = reason,
                    throwableType = error?.let { it.javaClass.name },
                    serverMessage = (error as? MobileApiException)?.serverMessage,
                    apiKind = (error as? MobileApiException)?.failureKind,
                ),
            )
        }
    }

    private fun emitSessionInvalidation() {
        sessionInvalidationEmitted = true
        mutableState.update {
            it.copy(
                isSessionInvalidated = true,
                contacts = emptyList(),
                pendingSessionInvalidation = ContactsSessionInvalidation(++nextInvalidationID),
            )
        }
    }


    private fun cancelRequest() {
        request.cancel()
    }

    override fun onCleared() {
        cancelRequest()
        mutableState.value = ContactsUiState()
        super.onCleared()
    }

    class Factory(
        private val username: String,
        private val repository: ContactsRepository,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(ContactsViewModel::class.java))
            return ContactsViewModel(username, repository, scope) as T
        }
    }
}

@Composable
internal fun rememberContactsViewModel(
    api: MobileApiClient,
    session: MemberSession,
): ContactsViewModel {
    val owner = requireNavigationViewModelStoreOwner("Contacts must be hosted by a Navigation 3 ViewModelStoreOwner.")
    val username = session.member.username
    val viewModel = rememberEntryViewModel(
        owner = owner,
        modelClass = ContactsViewModel::class.java,
        factory = ContactsViewModel.Factory(
            username = username,
            repository = MobileApiContactsRepository(api, session),
        ),
        key = "ContactsViewModel:$username",
    )
    androidx.compose.runtime.SideEffect { viewModel.updateEnvironment(api, session) }
    return viewModel
}
