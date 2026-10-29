package org.trustroots.android.ui.circles

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult

internal interface CircleRepository {
    /** Replaces the runtime API client, returning whether its normalized backend changed. */
    fun updateApi(api: MobileApiClient): Boolean = false
    /** Updates the live in-memory account session, returning whether credentials/account changed. */
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun circles(): Result<List<TrustrootsCircle>>
    suspend fun circleBySlug(slug: String): Result<TrustrootsCircle>
    suspend fun circleMembers(slug: String): Result<CircleMemberGroups>
    suspend fun memberships(): Result<Set<String>>
    suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit>
}

/** Keeps the website session in memory for requests made by this account's entry-scoped model. */
internal class MobileApiCircleRepository(
    api: MobileApiClient,
    session: MemberSession,
) : CircleRepository {
    private var api = api
    private var session = session

    override fun updateApi(api: MobileApiClient): Boolean {
        val changedBackend = this.api.backendURL != api.backendURL
        this.api = api
        return changedBackend
    }

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override suspend fun circles(): Result<List<TrustrootsCircle>> = api.circles(session)

    override suspend fun circleBySlug(slug: String): Result<TrustrootsCircle> = api.circle(session, slug)

    override suspend fun circleMembers(slug: String): Result<CircleMemberGroups> = api.circleMembers(session, slug)

    override suspend fun memberships(): Result<Set<String>> = api.circleMemberships(session)

    override suspend fun setMembership(circleID: String, isMember: Boolean): Result<Unit> =
        api.setCircleMembership(session, circleID, isMember)
}

internal data class CirclesSessionInvalidation(val id: Long)

internal enum class CirclesFailureKind {
    CIRCLES_LOAD,
    CIRCLE_DETAIL_LOAD,
    CIRCLE_MEMBERS_LOAD,
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
    data class MembershipChanged(val circleID: String, val isMember: Boolean) : CirclesEvent
    data class ToggleMembership(val circle: TrustrootsCircle) : CirclesEvent
    data object RetryLoad : CirclesEvent
    data class SessionInvalidationDelivered(val id: Long) : CirclesEvent
}

internal class CirclesViewModel(
    private val repository: CircleRepository,
    scope: CoroutineScope?,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(CirclesUiState())
    val state = mutableState.asStateFlow()

    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var membershipRevision = 0L
    private val loadRequest = LatestRequest(requestScope)
    private val membershipUpdate = LatestRequest(requestScope)

    init {
        load()
    }

    fun onEvent(event: CirclesEvent) {
        when (event) {
            is CirclesEvent.FilterChanged -> mutableState.update { it.copy(filter = event.value) }
            is CirclesEvent.MembershipChanged -> {
                if (!sessionInvalidationEmitted) {
                    membershipRevision++
                    mutableState.update { current ->
                        current.copy(
                            memberships = if (event.isMember) current.memberships + event.circleID
                            else current.memberships - event.circleID,
                        )
                    }
                }
            }
            is CirclesEvent.ToggleMembership -> toggleMembership(event.circle)
            CirclesEvent.RetryLoad -> if (!sessionInvalidationEmitted) load()
            is CirclesEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        val backendChanged = repository.updateApi(api)
        val sessionChanged = repository.updateSession(session)
        if (!backendChanged && !sessionChanged) return
        loadRequest.cancel()
        membershipUpdate.cancel()
        sessionInvalidationEmitted = false
        load(resetState = true)
    }

    private fun load(resetState: Boolean = false) {
        loadRequest.launch {
            val membershipRevisionAtStart = membershipRevision
            if (resetState) {
                mutableState.value = CirclesUiState()
                currentCoroutineContext().ensureActive()
            }
            mutableState.update { current ->
                current.copy(
                    isLoading = true,
                    failure = null,
                    canRetryLoad = false,
                )
            }
            val circleResult = requestResult { repository.circles() }
            circleResult.fold(
                onSuccess = { circles -> mutableState.update { it.copy(circles = circles) } },
                onFailure = { reportFailure(it, CirclesFailureKind.CIRCLES_LOAD, retryLoad = true) },
            )

            val membershipResult = requestResult { repository.memberships() }
            membershipResult.fold(
                onSuccess = { memberships ->
                    if (membershipRevisionAtStart == membershipRevision) {
                        mutableState.update { it.copy(memberships = memberships) }
                    }
                },
                onFailure = { reportFailure(it, CirclesFailureKind.MEMBERSHIPS_LOAD, retryLoad = true) },
            )
            currentCoroutineContext().ensureActive()
            mutableState.update { it.copy(isLoading = false) }
        }
    }

    private fun toggleMembership(circle: TrustrootsCircle) {
        if (sessionInvalidationEmitted || mutableState.value.updatingCircleID != null) return
        val joined = circle.id in mutableState.value.memberships
        membershipUpdate.launch {
            mutableState.update { it.copy(updatingCircleID = circle.id, failure = null, canRetryLoad = false) }
            val result = requestResult { repository.setMembership(circle.id, joined) }
            val requestContext = currentCoroutineContext()
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
                    requestContext.ensureActive()
                    mutableState.update { it.copy(updatingCircleID = null) }
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
            if (!sessionInvalidationEmitted) {
                val invalidation = CirclesSessionInvalidation(++nextInvalidationID)
                sessionInvalidationEmitted = true
                mutableState.update { current ->
                    current.copy(
                        pendingSessionInvalidation = invalidation,
                        canRetryLoad = false,
                        failure = null,
                    )
                }
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
        loadRequest.cancel()
        membershipUpdate.cancel()
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
