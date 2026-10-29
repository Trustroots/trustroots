package org.trustroots.android.ui.circledetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.circles.CircleRepository
import org.trustroots.android.ui.circles.CirclesFailure
import org.trustroots.android.ui.circles.CirclesFailureKind
import org.trustroots.android.ui.circles.CirclesSessionInvalidation

internal data class CircleDetailMembershipEvent(
    val id: Long,
    val circleID: String,
    val isMember: Boolean,
)

internal data class CircleDetailUiState(
    val circle: TrustrootsCircle? = null,
    val memberGroups: CircleMemberGroups? = null,
    val isLoadingMembers: Boolean = false,
    val membershipsLoaded: Boolean = false,
    val isMember: Boolean = false,
    val isLoading: Boolean = true,
    val isUpdating: Boolean = false,
    val failure: CirclesFailure? = null,
    val canRetryLoad: Boolean = false,
    val pendingSessionInvalidation: CirclesSessionInvalidation? = null,
    val pendingOverviewMembershipEvent: CircleDetailMembershipEvent? = null,
)

internal sealed interface CircleDetailEvent {
    data object RetryLoad : CircleDetailEvent
    data object ToggleMembership : CircleDetailEvent
    data class SessionInvalidationDelivered(val id: Long) : CircleDetailEvent
    data class OverviewMembershipEventDelivered(val id: Long) : CircleDetailEvent
}

internal class CircleDetailViewModel(
    private val slug: String,
    private val repository: CircleRepository,
    scope: CoroutineScope?,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(CircleDetailUiState())
    val state = mutableState.asStateFlow()

    private val loadRequest = LatestRequest(requestScope)
    private val membershipUpdate = LatestRequest(requestScope)
    // Mutations and environment changes can invalidate an in-flight membership snapshot.
    private var membershipRevision = 0L
    private var nextInvalidationID = 0L
    private var nextMembershipEventID = 0L
    private var sessionInvalidationEmitted = false

    init {
        load()
    }

    fun onEvent(event: CircleDetailEvent) {
        when (event) {
            CircleDetailEvent.RetryLoad -> if (!sessionInvalidationEmitted) load()
            CircleDetailEvent.ToggleMembership -> toggleMembership()
            is CircleDetailEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
            is CircleDetailEvent.OverviewMembershipEventDelivered -> mutableState.update { current ->
                if (current.pendingOverviewMembershipEvent?.id == event.id) {
                    current.copy(pendingOverviewMembershipEvent = null)
                } else current
            }
        }
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        val backendChanged = repository.updateApi(api)
        val sessionChanged = repository.updateSession(session)
        if (!backendChanged && !sessionChanged) return
        membershipRevision++
        loadRequest.cancel()
        membershipUpdate.cancel()
        sessionInvalidationEmitted = false
        load(resetState = true)
    }

    private fun load(resetState: Boolean = false) {
        if (sessionInvalidationEmitted) return
        // Keep a pending mutation alive; a completed mutation's group fetch is replaceable by this load.
        if (!mutableState.value.isUpdating) membershipUpdate.cancel()
        val membershipRevisionAtLoad = membershipRevision
        loadRequest.launch {
            if (resetState) {
                mutableState.value = CircleDetailUiState()
                currentCoroutineContext().ensureActive()
            }
            mutableState.update { current ->
                current.copy(
                    isLoading = true,
                    membershipsLoaded = false,
                    memberGroups = null,
                    isLoadingMembers = false,
                    failure = null,
                    canRetryLoad = false,
                    pendingOverviewMembershipEvent = null,
                )
            }
            val requestContext = currentCoroutineContext()
            val circleResult = requestResult { repository.circleBySlug(slug) }
            if (membershipRevisionAtLoad != membershipRevision) return@launch
            circleResult.fold(
                onSuccess = { circle ->
                    mutableState.update { it.copy(circle = circle) }
                    val membershipResult = requestResult { repository.memberships() }
                    if (membershipRevisionAtLoad != membershipRevision) return@launch
                    membershipResult.fold(
                        onSuccess = { memberships ->
                            val isMember = circle.id in memberships
                            mutableState.update {
                                it.copy(membershipsLoaded = true, isMember = isMember, isLoadingMembers = isMember)
                            }
                            if (isMember) {
                                val groupsResult = requestResult { repository.circleMembers(slug) }
                                if (membershipRevisionAtLoad != membershipRevision) return@launch
                                groupsResult.fold(
                                    onSuccess = { groups ->
                                        mutableState.update { it.copy(memberGroups = groups, isLoadingMembers = false) }
                                    },
                                    onFailure = {
                                        reportFailure(it, CirclesFailureKind.CIRCLE_MEMBERS_LOAD, retryLoad = true)
                                        requestContext.ensureActive()
                                        mutableState.update { state -> state.copy(isLoadingMembers = false) }
                                    },
                                )
                            }
                        },
                        onFailure = { reportFailure(it, CirclesFailureKind.MEMBERSHIPS_LOAD, retryLoad = true) },
                    )
                },
                onFailure = { reportFailure(it, CirclesFailureKind.CIRCLE_DETAIL_LOAD, retryLoad = true) },
            )
            currentCoroutineContext().ensureActive()
            mutableState.update { it.copy(isLoading = false) }
        }
    }

    private fun toggleMembership() {
        val current = state.value
        val circle = current.circle ?: return
        if (sessionInvalidationEmitted || !current.membershipsLoaded || current.isUpdating) return
        val joining = !current.isMember
        membershipUpdate.launch {
            mutableState.update { it.copy(isUpdating = true, failure = null, canRetryLoad = false) }
            val requestContext = currentCoroutineContext()
            requestResult { repository.setMembership(circle.id, isMember = !joining) }.fold(
                onSuccess = {
                    membershipRevision++
                    val event = CircleDetailMembershipEvent(
                        id = ++nextMembershipEventID,
                        circleID = circle.id,
                        isMember = joining,
                    )
                    mutableState.update {
                        it.copy(
                            isMember = joining,
                            isUpdating = false,
                            memberGroups = if (joining) it.memberGroups else null,
                            isLoadingMembers = joining,
                            failure = null,
                            canRetryLoad = false,
                            pendingOverviewMembershipEvent = event,
                        )
                    }
                    if (joining) {
                        requestResult { repository.circleMembers(slug) }.fold(
                            onSuccess = { groups ->
                                mutableState.update { it.copy(memberGroups = groups, isLoadingMembers = false) }
                            },
                            onFailure = { error ->
                                reportFailure(error, CirclesFailureKind.CIRCLE_MEMBERS_LOAD, retryLoad = true)
                                requestContext.ensureActive()
                                mutableState.update { it.copy(isLoadingMembers = false) }
                            },
                        )
                    }
                },
                onFailure = { error ->
                    reportFailure(error, CirclesFailureKind.MEMBERSHIP_UPDATE)
                    requestContext.ensureActive()
                    mutableState.update { it.copy(isUpdating = false) }
                },
            )
        }
    }

    private fun reportFailure(
        error: Throwable,
        kind: CirclesFailureKind,
        retryLoad: Boolean = false,
    ) {
        if (error.isAuthenticationFailure()) {
            if (sessionInvalidationEmitted) return
            sessionInvalidationEmitted = true
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    isUpdating = false,
                    canRetryLoad = false,
                    failure = null,
                    pendingSessionInvalidation = CirclesSessionInvalidation(++nextInvalidationID),
                )
            }
        } else {
            val apiError = error as? org.trustroots.android.api.MobileApiException
            mutableState.update {
                it.copy(
                    failure = CirclesFailure(
                        kind = kind,
                        serverMessage = apiError?.serverMessage?.takeIf(String::isNotBlank),
                        apiFailureKind = apiError?.failureKind,
                    ),
                    canRetryLoad = retryLoad,
                )
            }
        }
    }

    override fun onCleared() {
        membershipRevision++
        loadRequest.cancel()
        membershipUpdate.cancel()
        mutableState.value = CircleDetailUiState(isLoading = false)
        super.onCleared()
    }

    class Factory(
        private val slug: String,
        private val repository: CircleRepository,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(CircleDetailViewModel::class.java))
            return CircleDetailViewModel(slug, repository, scope) as T
        }
    }
}
