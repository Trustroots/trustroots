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
    suspend fun setMembership(circleID: String, isMember: Boolean, joinReason: String? = null): Result<Unit>
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
        val changed = this.session.credentialKey != session.credentialKey ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override suspend fun circles(): Result<List<TrustrootsCircle>> = api.circles(session)

    override suspend fun circleBySlug(slug: String): Result<TrustrootsCircle> = api.circle(session, slug)

    override suspend fun circleMembers(slug: String): Result<CircleMemberGroups> = api.circleMembers(session, slug)

    override suspend fun memberships(): Result<Set<String>> = api.circleMemberships(session)

    override suspend fun setMembership(circleID: String, isMember: Boolean, joinReason: String?): Result<Unit> =
        api.setCircleMembership(session, circleID, isMember, joinReason)
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

/** Account-scoped data reused by fresh overview visits while they refresh. */
internal class CirclesCache {
    private data class MembershipChange(val revision: Long, val isMember: Boolean)

    var circles: List<TrustrootsCircle>? = null
    var memberships: Set<String>? = null
    var loadRevision = 0L
    var membershipRevision = 0L
        private set
    private val membershipChanges = mutableMapOf<String, MembershipChange>()

    fun changeMembership(circleID: String, isMember: Boolean) {
        membershipChanges[circleID] = MembershipChange(++membershipRevision, isMember)
        memberships = memberships?.let { if (isMember) it + circleID else it - circleID }
    }

    fun applyChangesSince(snapshot: Set<String>, revision: Long): Set<String> =
        snapshot.toMutableSet().apply {
            membershipChanges.forEach { (circleID, change) ->
                if (change.revision > revision) {
                    if (change.isMember) add(circleID) else remove(circleID)
                }
            }
        }
}

internal data class CirclesUiState(
    val circles: List<TrustrootsCircle> = emptyList(),
    val memberships: Set<String> = emptySet(),
    val hasLoadedCatalogue: Boolean = false,
    val membershipsLoaded: Boolean = false,
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
    private var cache: CirclesCache = CirclesCache(),
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(cachedState())
    val state = mutableState.asStateFlow()

    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
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
                    changeMembership(event.circleID, event.isMember)
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

    fun updateEnvironment(api: MobileApiClient, session: MemberSession, cache: CirclesCache? = null) {
        val backendChanged = repository.updateApi(api)
        val sessionChanged = repository.updateSession(session)
        if (!backendChanged && !sessionChanged) return
        loadRequest.cancel()
        membershipUpdate.cancel()
        sessionInvalidationEmitted = false
        this.cache = cache ?: CirclesCache()
        mutableState.value = cachedState()
        load()
    }

    private fun cachedState() = CirclesUiState(
        circles = cache.circles.orEmpty(),
        memberships = cache.memberships.orEmpty(),
        hasLoadedCatalogue = cache.circles != null,
        membershipsLoaded = cache.memberships != null,
    )

    private fun load() {
        loadRequest.launch {
            val loadRevision = ++cache.loadRevision
            val cacheMembershipRevision = cache.membershipRevision
            mutableState.update { current ->
                current.copy(
                    isLoading = true,
                    failure = null,
                    canRetryLoad = false,
                )
            }
            val circleResult = requestResult { repository.circles() }
            circleResult.exceptionOrNull()?.let { reportFailure(it, CirclesFailureKind.CIRCLES_LOAD, retryLoad = true) }

            val membershipResult = requestResult { repository.memberships() }
            membershipResult.exceptionOrNull()?.let { reportFailure(it, CirclesFailureKind.MEMBERSHIPS_LOAD, retryLoad = true) }

            val circles = circleResult.getOrNull()
            val memberships = membershipResult.getOrNull()?.let { cache.applyChangesSince(it, cacheMembershipRevision) }
            if (loadRevision == cache.loadRevision && !sessionInvalidationEmitted) {
                if (circles != null) cache.circles = circles
                if (memberships != null) cache.memberships = memberships
            }
            mutableState.update { current ->
                val resolvedMemberships = cache.memberships ?: memberships
                current.copy(
                    circles = circles ?: current.circles,
                    memberships = resolvedMemberships ?: current.memberships,
                    hasLoadedCatalogue = current.hasLoadedCatalogue || circles != null,
                    membershipsLoaded = current.membershipsLoaded || resolvedMemberships != null,
                    isLoading = false,
                )
            }
        }
    }

    private fun changeMembership(circleID: String, isMember: Boolean) {
        cache.changeMembership(circleID, isMember)
        mutableState.update { current ->
            current.copy(
                memberships = if (isMember) current.memberships + circleID else current.memberships - circleID,
            )
        }
    }

    private fun toggleMembership(circle: TrustrootsCircle) {
        val current = mutableState.value
        if (sessionInvalidationEmitted || !current.membershipsLoaded || current.updatingCircleID != null) return
        val joined = circle.id in current.memberships
        membershipUpdate.launch {
            mutableState.update { it.copy(updatingCircleID = circle.id, failure = null, canRetryLoad = false) }
            val result = requestResult { repository.setMembership(circle.id, joined) }
            val requestContext = currentCoroutineContext()
            result.fold(
                onSuccess = {
                    changeMembership(circle.id, isMember = !joined)
                    mutableState.update { it.copy(updatingCircleID = null) }
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
                        serverMessage = apiError?.serverMessage,
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
        private val cache: CirclesCache = CirclesCache(),
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(CirclesViewModel::class.java))
            return CirclesViewModel(repository, scope = scope, cache = cache) as T
        }
    }
}
