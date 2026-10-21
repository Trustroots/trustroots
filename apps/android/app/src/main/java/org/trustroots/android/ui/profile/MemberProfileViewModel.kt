package org.trustroots.android.ui.profile

import androidx.compose.runtime.Composable
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
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.rememberEntryViewModel

internal interface MemberProfileRepository {
    fun updateApi(api: MobileApiClient): Boolean = false
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun profile(username: String): Result<MemberProfile>
    suspend fun hosting(memberID: String): Result<AccommodationOffer?>
    suspend fun contacts(memberID: String): Result<List<ProfileContact>>
    suspend fun references(memberID: String): Result<List<ProfileReference>>
    suspend fun relationship(memberID: String): Result<ContactRelationship>
    suspend fun removeContact(contactID: String): Result<Unit>
}

internal class MobileApiMemberProfileRepository(
    api: MobileApiClient,
    session: MemberSession,
) : MemberProfileRepository {
    private var api = api
    private var session = session

    override fun updateApi(api: MobileApiClient): Boolean {
        val changed = this.api.backendURL != api.backendURL
        this.api = api
        return changed
    }

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override suspend fun profile(username: String) = api.profile(session, username)
    override suspend fun hosting(memberID: String) = api.accommodationOffer(session, memberID)
    override suspend fun contacts(memberID: String) = api.contacts(session, memberID)
    override suspend fun references(memberID: String) = api.references(session, memberID)
    override suspend fun relationship(memberID: String) = api.contactWith(session, memberID)
    override suspend fun removeContact(contactID: String) = api.removeContact(session, contactID)
}

internal enum class MemberProfileFailureReason { PROFILE, HOSTING, CONTACTS, REFERENCES, RELATIONSHIP, REMOVE_CONTACT }

internal data class MemberProfileFailure(
    val reason: MemberProfileFailureReason,
    val apiKind: ApiFailureKind? = null,
    val serverMessage: String? = null,
)

internal data class MemberProfileSessionInvalidation(val id: Long)

internal data class MemberProfileUiState(
    val profile: MemberProfile? = null,
    val hosting: AccommodationOffer? = null,
    val hostingLoaded: Boolean = false,
    val contacts: List<ProfileContact> = emptyList(),
    val references: List<ProfileReference> = emptyList(),
    val relationship: ContactRelationship? = null,
    val relationshipResolved: Boolean = false,
    val isLoading: Boolean = true,
    val isRemovingContact: Boolean = false,
    val contactRemovalSucceeded: Boolean = false,
    val failure: MemberProfileFailure? = null,
    val removalFailure: MemberProfileFailure? = null,
    val pendingSessionInvalidation: MemberProfileSessionInvalidation? = null,
)

internal sealed interface MemberProfileEvent {
    data object ConfirmRemoveContact : MemberProfileEvent
    data object DismissRemoveContact : MemberProfileEvent
    data class ProfileSaved(val profile: MemberProfile) : MemberProfileEvent
    data object RefreshReferences : MemberProfileEvent
    data class SessionInvalidationDelivered(val id: Long) : MemberProfileEvent
}

internal class MemberProfileViewModel(
    private val username: String,
    ownUsername: String,
    private val repository: MemberProfileRepository,
    scope: CoroutineScope? = null,
) : ViewModel() {
    private var ownUsername = ownUsername
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(MemberProfileUiState())
    val state = mutableState.asStateFlow()
    private var generation = 0L
    private var nextInvalidationID = 0L
    private var invalidationEmitted = false
    private var loadJob: Job? = null
    private var removalJob: Job? = null
    private var referencesJob: Job? = null
    private var referencesGeneration = 0L

    init { load() }

    fun onEvent(event: MemberProfileEvent) {
        when (event) {
            MemberProfileEvent.ConfirmRemoveContact -> removeContact()
            MemberProfileEvent.RefreshReferences -> refreshReferences()
            MemberProfileEvent.DismissRemoveContact -> if (!mutableState.value.isRemovingContact) {
                mutableState.update { it.copy(removalFailure = null, contactRemovalSucceeded = false) }
            }
            is MemberProfileEvent.ProfileSaved -> if (!invalidationEmitted) {
                mutableState.update { it.copy(profile = event.profile) }
            }
            is MemberProfileEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) current.copy(pendingSessionInvalidation = null) else current
            }
        }
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        val accountChanged = ownUsername != session.member.username
        ownUsername = session.member.username
        val apiChanged = repository.updateApi(api)
        val sessionChanged = repository.updateSession(session)
        if (!apiChanged && !sessionChanged && !accountChanged) return

        generation++
        loadJob?.cancel()
        removalJob?.cancel()
        referencesGeneration++
        referencesJob?.cancel()
        invalidationEmitted = false
        mutableState.value = MemberProfileUiState()
        load()
    }

    private fun load() {
        val request = ++generation
        loadJob = requestScope.launch {
            val result = safe { repository.profile(username) }
            if (request != generation) return@launch
            val problem = result.exceptionOrNull()
            if (problem != null) {
                if (problem.isAuthenticationFailure()) invalidateSession(request)
                else mutableState.update { it.copy(isLoading = false, failure = failure(MemberProfileFailureReason.PROFILE, problem)) }
                return@launch
            }
            val member = result.getOrThrow()
            mutableState.update { it.copy(profile = member, isLoading = false, failure = null) }
            val id = member.id ?: return@launch
            launch {
                val value = safe { repository.hosting(id) }
                if (request != generation) return@launch
                value.fold(
                    onSuccess = { hosting -> mutableState.update { it.copy(hosting = hosting, hostingLoaded = true) } },
                    onFailure = { failure ->
                        mutableState.update { it.copy(hostingLoaded = true) }
                        if (failure.isAuthenticationFailure()) invalidateSession(request)
                    },
                )
            }
            launch {
                val value = safe { repository.contacts(id) }
                if (request != generation) return@launch
                value.onSuccess { contacts -> mutableState.update { it.copy(contacts = contacts.toList()) } }
                    .onFailure { if (it.isAuthenticationFailure()) invalidateSession(request) }
            }
            launch {
                val value = safe { repository.references(id) }
                if (request != generation) return@launch
                value.onSuccess { refs -> mutableState.update { it.copy(references = refs.toList()) } }
                    .onFailure { if (it.isAuthenticationFailure()) invalidateSession(request) }
            }
            if (member.username != ownUsername) launch {
                val value = safe { repository.relationship(id) }
                if (request != generation) return@launch
                value.fold(
                    onSuccess = { relationship -> mutableState.update { it.copy(relationship = relationship, relationshipResolved = true) } },
                    onFailure = { failure ->
                        if (failure.isAuthenticationFailure()) invalidateSession(request)
                        else mutableState.update { it.copy(relationshipResolved = true) }
                    },
                )
            }
        }
    }

    private fun removeContact() {
        if (invalidationEmitted) return
        val relationship = mutableState.value.relationship ?: return
        val id = relationship.id ?: return
        if (mutableState.value.isRemovingContact) return
        val request = generation
        removalJob?.cancel()
        mutableState.update { it.copy(isRemovingContact = true, removalFailure = null, contactRemovalSucceeded = false) }
        removalJob = requestScope.launch {
            val result = safe { repository.removeContact(id) }
            if (request != generation) return@launch
            result.fold(
                onSuccess = { mutableState.update { it.copy(relationship = ContactRelationship(null, false), isRemovingContact = false, contactRemovalSucceeded = true) } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession(request)
                    else mutableState.update { it.copy(isRemovingContact = false, removalFailure = failure(MemberProfileFailureReason.REMOVE_CONTACT, error)) }
                },
            )
        }
    }

    private fun refreshReferences() {
        if (invalidationEmitted) return
        val memberID = mutableState.value.profile?.id ?: return
        val request = ++referencesGeneration
        referencesJob?.cancel()
        referencesJob = requestScope.launch {
            val result = safe { repository.references(memberID) }
            if (request != referencesGeneration) return@launch
            result.onSuccess { references -> mutableState.update { it.copy(references = references.toList()) } }
                .onFailure { if (it.isAuthenticationFailure()) invalidateSession(generation) }
        }
    }

    private fun invalidateSession(request: Long) {
        if (request != generation || invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update { it.copy(isLoading = false, isRemovingContact = false,
            pendingSessionInvalidation = MemberProfileSessionInvalidation(++nextInvalidationID)) }
    }

    private fun failure(reason: MemberProfileFailureReason, error: Throwable) = MemberProfileFailure(
        reason = reason,
        apiKind = (error as? MobileApiException)?.failureKind,
        serverMessage = (error as? MobileApiException)?.serverMessage?.takeIf(String::isNotBlank),
    )

    private suspend fun <T> safe(block: suspend () -> Result<T>): Result<T> {
        val result = try { block() } catch (cancelled: CancellationException) { throw cancelled } catch (error: Throwable) { Result.failure(error) }
        currentCoroutineContext().ensureActive()
        (result.exceptionOrNull() as? CancellationException)?.let { throw it }
        return result
    }

    override fun onCleared() {
        generation++
        loadJob?.cancel()
        removalJob?.cancel()
        referencesGeneration++
        referencesJob?.cancel()
        mutableState.value = MemberProfileUiState(isLoading = false)
        super.onCleared()
    }

    class Factory(
        private val username: String,
        private val ownUsername: String,
        private val repository: MemberProfileRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(MemberProfileViewModel::class.java))
            return MemberProfileViewModel(username, ownUsername, repository) as T
        }
    }
}

@Composable
internal fun rememberMemberProfileViewModel(api: MobileApiClient, session: MemberSession, username: String): MemberProfileViewModel {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) { "Member profiles must be hosted by a Navigation 3 ViewModelStoreOwner." }
    return rememberEntryViewModel(
        owner = owner,
        modelClass = MemberProfileViewModel::class.java,
        factory = MemberProfileViewModel.Factory(
            username,
            session.member.username,
            MobileApiMemberProfileRepository(api, session),
        ),
        key = "MemberProfileViewModel:$username",
    )
}
