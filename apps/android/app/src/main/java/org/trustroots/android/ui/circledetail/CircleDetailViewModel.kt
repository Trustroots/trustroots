package org.trustroots.android.ui.circledetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.isAuthenticationFailure
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

    private var loadJob: Job? = null
    private var updateJob: Job? = null
    private var loadGeneration = 0L
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
        loadGeneration++
        loadJob?.cancel()
        updateJob?.cancel()
        sessionInvalidationEmitted = false
        mutableState.value = CircleDetailUiState()
        load()
    }

    private fun load() {
        if (sessionInvalidationEmitted) return
        val generation = ++loadGeneration
        loadJob?.cancel()
        mutableState.update { current ->
            current.copy(
                isLoading = true,
                membershipsLoaded = false,
                failure = null,
                canRetryLoad = false,
                pendingOverviewMembershipEvent = null,
            )
        }
        loadJob = requestScope.launch {
            val circleResult = request { repository.circleBySlug(slug) }
            if (generation != loadGeneration) return@launch
            circleResult.fold(
                onSuccess = { circle ->
                    mutableState.update { it.copy(circle = circle) }
                    val membershipResult = request { repository.memberships() }
                    if (generation != loadGeneration) return@launch
                    membershipResult.fold(
                        onSuccess = { memberships ->
                            mutableState.update {
                                it.copy(membershipsLoaded = true, isMember = circle.id in memberships)
                            }
                        },
                        onFailure = { reportFailure(it, CirclesFailureKind.MEMBERSHIPS_LOAD, retryLoad = true) },
                    )
                },
                onFailure = { reportFailure(it, CirclesFailureKind.CIRCLE_DETAIL_LOAD, retryLoad = true) },
            )
            if (generation == loadGeneration) mutableState.update { it.copy(isLoading = false) }
        }
    }

    private fun toggleMembership() {
        val current = state.value
        val circle = current.circle ?: return
        if (sessionInvalidationEmitted || !current.membershipsLoaded || current.isUpdating) return
        val joining = !current.isMember
        mutableState.update { it.copy(isUpdating = true, failure = null, canRetryLoad = false) }
        updateJob?.cancel()
        updateJob = requestScope.launch {
            request { repository.setMembership(circle.id, isMember = !joining) }.fold(
                onSuccess = {
                    val event = CircleDetailMembershipEvent(
                        id = ++nextMembershipEventID,
                        circleID = circle.id,
                        isMember = joining,
                    )
                    mutableState.update {
                        it.copy(
                            isMember = joining,
                            isUpdating = false,
                            pendingOverviewMembershipEvent = event,
                        )
                    }
                },
                onFailure = { error ->
                    reportFailure(error, CirclesFailureKind.MEMBERSHIP_UPDATE)
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

    override fun onCleared() {
        loadGeneration++
        loadJob?.cancel()
        updateJob?.cancel()
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
