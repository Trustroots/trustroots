package org.trustroots.android.ui.contacts

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.ui.common.isAuthenticationFailure

internal interface ContactsRepository {
    suspend fun profile(username: String): Result<MemberProfile>
    suspend fun contacts(memberID: String): Result<List<ProfileContact>>
}

/** Keeps the live API client and session in memory for the owning entry only. */
internal class MobileApiContactsRepository(
    private val api: MobileApiClient,
    private val session: MemberSession,
) : ContactsRepository {
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
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(ContactsUiState())
    val state = mutableState.asStateFlow()

    private var requestGeneration = 0L
    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var requestJob: Job? = null

    init {
        load()
    }

    fun onEvent(event: ContactsEvent) {
        when (event) {
            ContactsEvent.Retry -> load(force = true)
            is ContactsEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    private fun load(force: Boolean = false) {
        val current = mutableState.value
        if (sessionInvalidationEmitted || current.isLoading || (current.hasAttemptedLoad && !force)) return

        requestGeneration++
        val generation = requestGeneration
        requestJob?.cancel()
        mutableState.update { it.copy(isLoading = true, failure = null) }
        requestJob = requestScope.launch {
            val profileResult = request { repository.profile(username) }
            val profileFailure = profileResult.exceptionOrNull()
            if (profileFailure != null) {
                finishFailure(generation, ContactsFailureReason.PROFILE, profileFailure)
                return@launch
            }
            val memberID = profileResult.getOrThrow().id
            if (memberID == null) {
                finishFailure(generation, ContactsFailureReason.MISSING_MEMBER_ID, null)
                return@launch
            }

            val contactsResult = request { repository.contacts(memberID) }
            val contactsFailure = contactsResult.exceptionOrNull()
            if (contactsFailure != null) {
                finishFailure(generation, ContactsFailureReason.CONTACTS, contactsFailure)
                return@launch
            }
            if (generation != requestGeneration) return@launch
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

    private fun finishFailure(generation: Long, reason: ContactsFailureReason, error: Throwable?) {
        if (generation != requestGeneration) return
        if (error?.isAuthenticationFailure() == true) {
            emitSessionInvalidation()
            mutableState.update { it.copy(isLoading = false, hasAttemptedLoad = true) }
            return
        }
        mutableState.update {
            it.copy(
                isLoading = false,
                hasAttemptedLoad = true,
                failure = ContactsFailure(
                    reason = reason,
                    throwableType = error?.javaClass?.name,
                    serverMessage = (error as? MobileApiException)?.serverMessage?.takeIf(String::isNotBlank),
                    apiKind = (error as? MobileApiException)?.failureKind,
                ),
            )
        }
    }

    private fun emitSessionInvalidation() {
        if (sessionInvalidationEmitted) return
        sessionInvalidationEmitted = true
        mutableState.update {
            it.copy(pendingSessionInvalidation = ContactsSessionInvalidation(++nextInvalidationID))
        }
    }

    private suspend fun <T> request(operation: suspend () -> Result<T>): Result<T> {
        val result = try {
            operation()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            Result.failure(error)
        }
        currentCoroutineContext().ensureActive()
        (result.exceptionOrNull() as? CancellationException)?.let { throw it }
        return result
    }

    private fun cancelRequest() {
        requestGeneration++
        requestJob?.cancel()
        requestJob = null
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
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "Contacts must be hosted by a Navigation 3 ViewModelStoreOwner."
    }
    return remember(owner, api, session) {
        owner.contactsViewModel(api, session)
    }
}

internal fun ViewModelStoreOwner.contactsViewModel(
    api: MobileApiClient,
    session: MemberSession,
): ContactsViewModel {
    val username = session.member.username
    return ViewModelProvider(
        this,
        ContactsViewModel.Factory(
            username = username,
            repository = MobileApiContactsRepository(api, session),
        ),
    )["ContactsViewModel:$username", ContactsViewModel::class.java]
}
