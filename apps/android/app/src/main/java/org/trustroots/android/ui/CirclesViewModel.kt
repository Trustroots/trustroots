package org.trustroots.android.ui

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
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.isAuthenticationFailure

internal interface CircleRepository {
    /** Updates the live in-memory account session, returning whether credentials/account changed. */
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun circles(): Result<List<TrustrootsCircle>>
    suspend fun memberships(): Result<Set<String>>
    suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit>
}

/** Keeps the website session in memory for requests made by this account's entry-scoped model. */
internal class MobileApiCircleRepository(
    private val api: MobileApiClient,
    session: MemberSession,
) : CircleRepository {
    private var session = session

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override suspend fun circles(): Result<List<TrustrootsCircle>> = api.circles(session)

    override suspend fun memberships(): Result<Set<String>> = api.circleMemberships(session)

    override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> =
        api.setCircleMembership(session, circleID, isMember)
}

internal data class CirclesSessionInvalidation(val id: Long)

internal enum class CirclesFailureKind {
    CIRCLES_LOAD,
    MEMBERSHIPS_LOAD,
    MEMBERSHIP_UPDATE,
}

internal data class CirclesFailure(
    val kind: CirclesFailureKind,
    val serverMessage: String?,
    val apiFailureKind: ApiFailureKind?,
)

internal data class CirclesUiState(
    val circles: List<TrustrootsCircle> = emptyList(),
    val memberships: Set<String> = emptySet(),
    val filter: String = "",
    val selectedCircle: TrustrootsCircle? = null,
    val isLoading: Boolean = true,
    val updatingCircleID: String? = null,
    val failure: CirclesFailure? = null,
    val canRetryLoad: Boolean = false,
    val pendingSessionInvalidation: CirclesSessionInvalidation? = null,
) {
    val visibleCircles: List<TrustrootsCircle>
        get() = circles.filter { circle ->
            val description = circle.description?.let(::circleDescriptionText).orEmpty()
            "${circle.label} $description".contains(filter.trim(), ignoreCase = true)
        }.sortedWith(compareByDescending<TrustrootsCircle> { it.count }.thenBy { it.label })
}

internal sealed interface CirclesEvent {
    data class FilterChanged(val value: String) : CirclesEvent
    data class CircleSelected(val circle: TrustrootsCircle) : CirclesEvent
    data object BackFromDetail : CirclesEvent
    data class ToggleMembership(val circle: TrustrootsCircle) : CirclesEvent
    data object RetryLoad : CirclesEvent
    data class SessionInvalidationDelivered(val id: Long) : CirclesEvent
}

internal class CirclesViewModel(
    private val repository: CircleRepository,
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(CirclesUiState())
    val state = mutableState.asStateFlow()

    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var loadGeneration = 0L
    private var membershipRevision = 0L
    private var loadJob: Job? = null
    private var updateJob: Job? = null

    init {
        load()
    }

    fun onEvent(event: CirclesEvent) {
        when (event) {
            is CirclesEvent.FilterChanged -> mutableState.update { it.copy(filter = event.value) }
            is CirclesEvent.CircleSelected -> mutableState.update { it.copy(selectedCircle = event.circle) }
            CirclesEvent.BackFromDetail -> mutableState.update { it.copy(selectedCircle = null) }
            is CirclesEvent.ToggleMembership -> toggleMembership(event.circle)
            CirclesEvent.RetryLoad -> if (!sessionInvalidationEmitted) load()
            is CirclesEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    fun updateSession(session: MemberSession) {
        if (!repository.updateSession(session)) return
        loadJob?.cancel()
        updateJob?.cancel()
        sessionInvalidationEmitted = false
        mutableState.value = CirclesUiState()
        load()
    }

    private fun load() {
        val generation = ++loadGeneration
        loadJob?.cancel()
        mutableState.update { current ->
            current.copy(
                isLoading = true,
                failure = null,
                canRetryLoad = false,
            )
        }
        loadJob = requestScope.launch {
            val membershipRevisionAtStart = membershipRevision
            val circleResult = request { repository.circles() }
            if (generation != loadGeneration) return@launch
            circleResult.fold(
                onSuccess = { circles -> mutableState.update { it.copy(circles = circles) } },
                onFailure = { reportFailure(it, CirclesFailureKind.CIRCLES_LOAD, retryLoad = true) },
            )

            val membershipResult = request { repository.memberships() }
            if (generation != loadGeneration) return@launch
            membershipResult.fold(
                onSuccess = { memberships ->
                    if (membershipRevisionAtStart == membershipRevision) {
                        mutableState.update { it.copy(memberships = memberships) }
                    }
                },
                onFailure = { reportFailure(it, CirclesFailureKind.MEMBERSHIPS_LOAD, retryLoad = true) },
            )
            if (generation == loadGeneration) mutableState.update { it.copy(isLoading = false) }
        }
    }

    private fun toggleMembership(circle: TrustrootsCircle) {
        if (sessionInvalidationEmitted || mutableState.value.updatingCircleID != null) return
        val joined = circle.id in mutableState.value.memberships
        mutableState.update { it.copy(updatingCircleID = circle.id, failure = null, canRetryLoad = false) }
        updateJob = requestScope.launch {
            val result = request { repository.setMembership(circle.id, joined) }
            result.fold(
                onSuccess = {
                    membershipRevision++
                    mutableState.update { current ->
                        current.copy(
                            memberships = if (joined) current.memberships - circle.id
                            else current.memberships + circle.id,
                            updatingCircleID = null,
                        )
                    }
                },
                onFailure = { error ->
                    reportFailure(error, CirclesFailureKind.MEMBERSHIP_UPDATE)
                    mutableState.update { it.copy(updatingCircleID = null) }
                },
            )
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

    private fun reportFailure(
        error: Throwable,
        kind: CirclesFailureKind,
        retryLoad: Boolean = false,
    ) {
        if (error.isAuthenticationFailure()) {
            if (!sessionInvalidationEmitted && mutableState.value.pendingSessionInvalidation == null) {
                val invalidation = CirclesSessionInvalidation(++nextInvalidationID)
                sessionInvalidationEmitted = true
                mutableState.update { current ->
                    if (current.pendingSessionInvalidation != null) current
                    else current.copy(
                        pendingSessionInvalidation = invalidation,
                        canRetryLoad = false,
                        failure = null,
                    )
                }
            }
        } else {
            mutableState.update {
                it.copy(
                    failure = CirclesFailure(
                        kind = kind,
                        serverMessage = (error as? org.trustroots.android.api.MobileApiException)
                            ?.serverMessage?.takeIf(String::isNotBlank),
                        apiFailureKind = (error as? org.trustroots.android.api.MobileApiException)?.failureKind,
                    ),
                    canRetryLoad = retryLoad,
                )
            }
        }
    }

    override fun onCleared() {
        loadJob?.cancel()
        updateJob?.cancel()
        mutableState.value = CirclesUiState(isLoading = false)
        super.onCleared()
    }

    class Factory(
        private val repository: CircleRepository,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(CirclesViewModel::class.java))
            return CirclesViewModel(repository, scope = scope) as T
        }
    }
}
