package org.trustroots.android.ui.profile

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.runtime.Composable
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
import kotlinx.coroutines.launch
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.requestResult

internal interface MemberProfileRepository {
    fun updateApi(api: MobileApiClient): Boolean = false
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun profile(username: String): Result<MemberProfile>
    suspend fun hosting(memberID: String): Result<AccommodationOffer?>
    suspend fun contacts(memberID: String): Result<List<ProfileContact>>
    suspend fun references(memberID: String): Result<List<ProfileReference>>
    suspend fun relationship(memberID: String): Result<ContactRelationship>
    suspend fun removeContact(contactID: String): Result<Unit>
    suspend fun blockedMembers(): Result<List<MessageMember>>
    suspend fun setMemberBlocked(username: String, blocked: Boolean): Result<Unit>
    suspend fun reportMember(username: String, message: String): Result<Unit>
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
    override suspend fun blockedMembers() = api.blockedMembers(session)
    override suspend fun setMemberBlocked(username: String, blocked: Boolean) =
        api.setMemberBlocked(session, username, blocked)
    override suspend fun reportMember(username: String, message: String) =
        api.reportMember(session, username, message)
}

internal enum class MemberProfileFailureReason {
    PROFILE, HOSTING, CONTACTS, REFERENCES, RELATIONSHIP, REMOVE_CONTACT,
    BLOCK_STATUS, BLOCK_UPDATE, REPORT,
}

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
    val isBlocked: Boolean? = null,
    val isLoadingBlock: Boolean = false,
    val isUpdatingBlock: Boolean = false,
    val blockFailure: MemberProfileFailure? = null,
    val reportDraft: String = "",
    val isSubmittingReport: Boolean = false,
    val reportSubmitted: Boolean = false,
    val reportFailure: MemberProfileFailure? = null,
    val pendingSessionInvalidation: MemberProfileSessionInvalidation? = null,
)

internal sealed interface MemberProfileEvent {
    data object ConfirmRemoveContact : MemberProfileEvent
    data object DismissRemoveContact : MemberProfileEvent
    data class ProfileSaved(val profile: MemberProfile) : MemberProfileEvent
    data object RefreshReferences : MemberProfileEvent
    data object RetryBlockStatus : MemberProfileEvent
    data class SetBlocked(val blocked: Boolean) : MemberProfileEvent
    data class ReportDraftChanged(val message: String) : MemberProfileEvent
    data object SubmitReport : MemberProfileEvent
    data object DismissReport : MemberProfileEvent
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
    private var nextInvalidationID = 0L
    private var invalidationEmitted = false
    private val loadRequest = LatestRequest(requestScope)
    private val removalRequest = LatestRequest(requestScope)
    private val referencesRequest = LatestRequest(requestScope)
    private val blockStatusRequest = LatestRequest(requestScope)
    private val blockUpdateRequest = LatestRequest(requestScope)
    private val reportRequest = LatestRequest(requestScope)

    init { load() }

    fun onEvent(event: MemberProfileEvent) {
        when (event) {
            MemberProfileEvent.ConfirmRemoveContact -> removeContact()
            MemberProfileEvent.RefreshReferences -> refreshReferences()
            MemberProfileEvent.RetryBlockStatus -> loadBlockStatus()
            is MemberProfileEvent.SetBlocked -> setBlocked(event.blocked)
            is MemberProfileEvent.ReportDraftChanged -> if (!mutableState.value.isSubmittingReport) {
                mutableState.update { it.copy(reportDraft = event.message, reportFailure = null, reportSubmitted = false) }
            }
            MemberProfileEvent.SubmitReport -> submitReport()
            MemberProfileEvent.DismissReport -> if (!mutableState.value.isSubmittingReport) {
                mutableState.update { it.copy(reportDraft = "", reportFailure = null, reportSubmitted = false) }
            }
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

        cancelRequests()
        invalidationEmitted = false
        mutableState.value = MemberProfileUiState()
        load()
    }

    private fun load() {
        loadRequest.launch {
            val result = requestResult { repository.profile(username) }
            val problem = result.exceptionOrNull()
            if (problem != null) {
                if (problem.isAuthenticationFailure()) invalidateSession()
                else mutableState.update { it.copy(isLoading = false, failure = failure(MemberProfileFailureReason.PROFILE, problem)) }
                return@launch
            }
            val member = result.getOrThrow()
            mutableState.update { it.copy(profile = member, isLoading = false, failure = null) }
            currentCoroutineContext().ensureActive()
            if (!isOwnMember(member.username)) loadBlockStatus()
            val id = member.id ?: return@launch
            launch {
                val value = requestResult { repository.hosting(id) }
                value.fold(
                    onSuccess = { hosting -> mutableState.update { it.copy(hosting = hosting, hostingLoaded = true) } },
                    onFailure = { failure ->
                        mutableState.update { it.copy(hostingLoaded = true) }
                        if (failure.isAuthenticationFailure()) invalidateSession()
                    },
                )
            }
            launch {
                val value = requestResult { repository.contacts(id) }
                value.onSuccess { contacts -> mutableState.update { it.copy(contacts = contacts.toList()) } }
                    .onFailure { if (it.isAuthenticationFailure()) invalidateSession() }
            }
            launch {
                val value = requestResult { repository.references(id) }
                value.onSuccess { refs -> mutableState.update { it.copy(references = refs.toList()) } }
                    .onFailure { if (it.isAuthenticationFailure()) invalidateSession() }
            }
            if (!isOwnMember(member.username)) launch {
                val value = requestResult { repository.relationship(id) }
                value.fold(
                    onSuccess = { relationship -> mutableState.update { it.copy(relationship = relationship, relationshipResolved = true) } },
                    onFailure = { failure ->
                        if (failure.isAuthenticationFailure()) invalidateSession()
                        else mutableState.update { it.copy(relationshipResolved = true) }
                    },
                )
            }
        }
    }

    private fun isOwnMember(memberUsername: String): Boolean =
        memberUsername.equals(ownUsername, ignoreCase = true)

    private fun loadBlockStatus() {
        if (invalidationEmitted) return
        val member = mutableState.value.profile ?: return
        if (isOwnMember(member.username) || mutableState.value.isLoadingBlock || mutableState.value.isUpdatingBlock) return
        blockStatusRequest.launch {
            mutableState.update { it.copy(isLoadingBlock = true, blockFailure = null) }
            val result = requestResult { repository.blockedMembers() }
            if (invalidationEmitted) return@launch
            result.fold(
                onSuccess = { blockedMembers ->
                    val blocked = blockedMembers.any { candidate ->
                        val sameID = candidate.id != null && member.id != null && candidate.id == member.id
                        sameID || candidate.username?.equals(member.username, ignoreCase = true) == true
                    }
                    mutableState.update { it.copy(isBlocked = blocked, isLoadingBlock = false, blockFailure = null) }
                },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update {
                        it.copy(isLoadingBlock = false, blockFailure = failure(MemberProfileFailureReason.BLOCK_STATUS, error))
                    }
                },
            )
        }
    }

    private fun setBlocked(blocked: Boolean) {
        if (invalidationEmitted) return
        val current = mutableState.value
        val member = current.profile ?: return
        if (isOwnMember(member.username) || current.isBlocked == null || current.isBlocked == blocked ||
            current.isLoadingBlock || current.isUpdatingBlock
        ) return
        blockUpdateRequest.launch {
            mutableState.update { it.copy(isUpdatingBlock = true, blockFailure = null) }
            val result = requestResult { repository.setMemberBlocked(member.username, blocked) }
            if (invalidationEmitted) return@launch
            result.fold(
                onSuccess = { mutableState.update { it.copy(isBlocked = blocked, isUpdatingBlock = false, blockFailure = null) } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update {
                        it.copy(isUpdatingBlock = false, blockFailure = failure(MemberProfileFailureReason.BLOCK_UPDATE, error))
                    }
                },
            )
        }
    }

    private fun submitReport() {
        if (invalidationEmitted) return
        val current = mutableState.value
        val member = current.profile ?: return
        val message = current.reportDraft.trim()
        if (isOwnMember(member.username) || message.isEmpty() || current.isSubmittingReport || current.reportSubmitted) return
        reportRequest.launch {
            mutableState.update { it.copy(isSubmittingReport = true, reportFailure = null, reportSubmitted = false) }
            val result = requestResult { repository.reportMember(member.username, message) }
            if (invalidationEmitted) return@launch
            result.fold(
                onSuccess = { mutableState.update { it.copy(isSubmittingReport = false, reportSubmitted = true, reportFailure = null) } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update {
                        it.copy(isSubmittingReport = false, reportFailure = failure(MemberProfileFailureReason.REPORT, error))
                    }
                },
            )
        }
    }

    private fun removeContact() {
        if (invalidationEmitted) return
        val relationship = mutableState.value.relationship ?: return
        val id = relationship.id ?: return
        if (mutableState.value.isRemovingContact) return
        removalRequest.launch {
            mutableState.update { it.copy(isRemovingContact = true, removalFailure = null, contactRemovalSucceeded = false) }
            val result = requestResult { repository.removeContact(id) }
            result.fold(
                onSuccess = { mutableState.update { it.copy(relationship = ContactRelationship(null, false), isRemovingContact = false, contactRemovalSucceeded = true) } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update { it.copy(isRemovingContact = false, removalFailure = failure(MemberProfileFailureReason.REMOVE_CONTACT, error)) }
                },
            )
        }
    }

    private fun refreshReferences() {
        if (invalidationEmitted) return
        val memberID = mutableState.value.profile?.id ?: return
        referencesRequest.launch {
            val result = requestResult { repository.references(memberID) }
            result.onSuccess { references -> mutableState.update { it.copy(references = references.toList()) } }
                .onFailure { if (it.isAuthenticationFailure()) invalidateSession() }
        }
    }

    private suspend fun invalidateSession() {
        currentCoroutineContext().ensureActive()
        if (invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update { it.copy(isLoading = false, isRemovingContact = false,
            isLoadingBlock = false, isUpdatingBlock = false, isSubmittingReport = false,
            reportDraft = "", reportSubmitted = false, reportFailure = null,
            pendingSessionInvalidation = MemberProfileSessionInvalidation(++nextInvalidationID)) }
    }

    private fun failure(reason: MemberProfileFailureReason, error: Throwable) = MemberProfileFailure(
        reason = reason,
        apiKind = (error as? MobileApiException)?.failureKind,
        serverMessage = (error as? MobileApiException)?.serverMessage,
    )


    override fun onCleared() {
        cancelRequests()
        mutableState.value = MemberProfileUiState(isLoading = false)
        super.onCleared()
    }

    private fun cancelRequests() {
        loadRequest.cancel()
        removalRequest.cancel()
        referencesRequest.cancel()
        blockStatusRequest.cancel()
        blockUpdateRequest.cancel()
        reportRequest.cancel()
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
    val owner = requireNavigationViewModelStoreOwner("Member profiles must be hosted by a Navigation 3 ViewModelStoreOwner.")
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
