package org.trustroots.android.ui

import org.trustroots.android.ui.common.isAuthenticationFailure

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException

internal interface MemberShellRepository {
    /** Replaces runtime request dependencies; true means the account or backend changed. */
    fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean
    suspend fun ownAvatarID(): Result<String?>
    suspend fun unreadCount(): Result<Int>
}

internal class MobileApiMemberShellRepository(
    private var api: MobileApiClient,
    private var session: MemberSession,
) : MemberShellRepository {
    override fun updateEnvironment(api: MobileApiClient, session: MemberSession): Boolean {
        val changed = this.api.backendURL != api.backendURL ||
            this.session.member.username != session.member.username ||
            this.session.cookieHeader != session.cookieHeader
        this.api = api
        this.session = session
        return changed
    }

    override suspend fun ownAvatarID(): Result<String?> =
        api.profile(session, session.member.username).map { it.id }

    override suspend fun unreadCount(): Result<Int> =
        api.inbox(session).map { threads -> threads.count { !it.read } }
}

internal data class MemberShellInvalidation(val id: Long)

internal data class MemberShellFailure(
    val serverMessage: String?,
    val apiFailureKind: ApiFailureKind?,
)

internal data class MemberShellUiState(
    val avatarID: String? = null,
    val unreadMessageCount: Int = 0,
    val isAvatarLoading: Boolean = true,
    val isUnreadRefreshing: Boolean = false,
    val failure: MemberShellFailure? = null,
    val pendingSessionInvalidation: MemberShellInvalidation? = null,
)

internal sealed interface MemberShellEvent {
    data class EnvironmentChanged(val api: MobileApiClient, val session: MemberSession) : MemberShellEvent
    data class ActiveVisitChanged(val visitID: Long) : MemberShellEvent
    data class LifecycleChanged(val started: Boolean) : MemberShellEvent
    data object RefreshUnread : MemberShellEvent
    data object RetryAvatar : MemberShellEvent
    data class InvalidationDelivered(val id: Long) : MemberShellEvent
}

internal class MemberShellViewModel(
    private val repository: MemberShellRepository,
    scope: CoroutineScope? = null,
    private val waitForNextPoll: suspend () -> Unit = { delay(60_000) },
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(MemberShellUiState())
    val state = mutableState.asStateFlow()

    private var avatarJob: Job? = null
    private var pollJob: Job? = null
    private var nextInvalidationID = 0L
    private var nextRequestGeneration = 0L
    private var avatarGeneration = 0L
    private var unreadGeneration = 0L
    private var sessionInvalidationEmitted = false
    private var started = false
    private var activeVisitID: Long? = null

    init { loadAvatar() }

    fun onEvent(event: MemberShellEvent) {
        when (event) {
            is MemberShellEvent.EnvironmentChanged -> updateEnvironment(event.api, event.session)
            is MemberShellEvent.ActiveVisitChanged -> {
                if (activeVisitID != event.visitID) {
                    activeVisitID = event.visitID
                    restartPolling()
                }
            }
            is MemberShellEvent.LifecycleChanged -> {
                if (started != event.started) {
                    started = event.started
                    restartPolling()
                }
            }
            MemberShellEvent.RefreshUnread -> restartPolling()
            MemberShellEvent.RetryAvatar -> if (!sessionInvalidationEmitted) loadAvatar()
            is MemberShellEvent.InvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    private fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        if (!repository.updateEnvironment(api, session)) return
        avatarJob?.cancel()
        pollJob?.cancel()
        avatarGeneration = ++nextRequestGeneration
        unreadGeneration = ++nextRequestGeneration
        sessionInvalidationEmitted = false
        mutableState.value = MemberShellUiState()
        loadAvatar()
        restartPolling()
    }

    private fun loadAvatar() {
        val generation = ++nextRequestGeneration
        avatarGeneration = generation
        avatarJob?.cancel()
        mutableState.update { it.copy(isAvatarLoading = true, failure = null) }
        avatarJob = requestScope.launch {
            request { repository.ownAvatarID() }.fold(
                onSuccess = { id ->
                    if (generation == avatarGeneration) {
                        mutableState.update { it.copy(avatarID = id, isAvatarLoading = false) }
                    }
                },
                onFailure = { error ->
                    if (generation == avatarGeneration) {
                        mutableState.update { it.copy(isAvatarLoading = false) }
                        reportFailure(error)
                    }
                },
            )
        }
    }

    private fun restartPolling() {
        pollJob?.cancel()
        pollJob = null
        unreadGeneration = ++nextRequestGeneration
        if (!started || activeVisitID == null || sessionInvalidationEmitted) {
            mutableState.update { it.copy(isUnreadRefreshing = false) }
            return
        }
        val generation = unreadGeneration
        pollJob = requestScope.launch {
            while (generation == unreadGeneration && started) {
                mutableState.update { it.copy(isUnreadRefreshing = true, failure = null) }
                request { repository.unreadCount() }.fold(
                    onSuccess = { count ->
                        if (generation == unreadGeneration) {
                            mutableState.update {
                                it.copy(unreadMessageCount = count, isUnreadRefreshing = false)
                            }
                        }
                    },
                    onFailure = { error ->
                        if (generation == unreadGeneration) {
                            mutableState.update { it.copy(isUnreadRefreshing = false) }
                            reportFailure(error)
                        }
                    },
                )
                if (generation != unreadGeneration || !started || sessionInvalidationEmitted) break
                waitForNextPoll()
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

    private fun reportFailure(error: Throwable) {
        if (error.isAuthenticationFailure()) {
            if (!sessionInvalidationEmitted && mutableState.value.pendingSessionInvalidation == null) {
                sessionInvalidationEmitted = true
                avatarJob?.cancel()
                avatarGeneration = ++nextRequestGeneration
                pollJob?.cancel()
                unreadGeneration = ++nextRequestGeneration
                mutableState.update {
                    it.copy(pendingSessionInvalidation = MemberShellInvalidation(++nextInvalidationID))
                }
            }
        } else {
            val apiError = error as? MobileApiException
            mutableState.update {
                it.copy(
                    failure = MemberShellFailure(
                        serverMessage = apiError?.serverMessage?.takeIf(String::isNotBlank),
                        apiFailureKind = apiError?.failureKind,
                    ),
                )
            }
        }
    }

    override fun onCleared() {
        avatarGeneration = ++nextRequestGeneration
        unreadGeneration = ++nextRequestGeneration
        started = false
        activeVisitID = null
        avatarJob?.cancel()
        pollJob?.cancel()
        mutableState.value = MemberShellUiState(isAvatarLoading = false)
        super.onCleared()
    }

    class Factory(
        private val repository: MemberShellRepository,
        private val scope: CoroutineScope? = null,
        private val waitForNextPoll: suspend () -> Unit = { delay(60_000) },
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(MemberShellViewModel::class.java))
            return MemberShellViewModel(repository, scope = scope, waitForNextPoll = waitForNextPoll) as T
        }
    }
}

@Composable
internal fun rememberMemberShellViewModel(
    api: MobileApiClient,
    session: MemberSession,
): MemberShellViewModel {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "The member shell must be hosted by its root Navigation 3 entry."
    }
    val viewModel = remember(owner, api, session) {
        ViewModelProvider(owner, MemberShellViewModel.Factory(MobileApiMemberShellRepository(api, session)))
            .get(MemberShellViewModel::class.java)
    }
    SideEffect { viewModel.onEvent(MemberShellEvent.EnvironmentChanged(api, session)) }
    return viewModel
}
