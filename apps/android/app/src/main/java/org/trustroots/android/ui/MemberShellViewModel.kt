package org.trustroots.android.ui

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.rememberEntryViewModel

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
    scope: CoroutineScope?,
    private val waitForNextPoll: suspend () -> Unit = { delay(60_000) },
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(MemberShellUiState())
    val state = mutableState.asStateFlow()

    private val avatarRequest = LatestRequest(requestScope)
    private val unreadPolling = LatestRequest(requestScope)
    private var nextInvalidationID = 0L
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
        avatarRequest.cancel()
        unreadPolling.cancel()
        sessionInvalidationEmitted = false
        mutableState.value = MemberShellUiState()
        loadAvatar()
        restartPolling()
    }

    private fun loadAvatar() {
        avatarRequest.launch {
            mutableState.update { it.copy(isAvatarLoading = true, failure = null) }
            requestResult { repository.ownAvatarID() }.fold(
                onSuccess = { id ->
                    mutableState.update { it.copy(avatarID = id, isAvatarLoading = false) }
                },
                onFailure = { error ->
                    mutableState.update { it.copy(isAvatarLoading = false) }
                    reportFailure(error)
                },
            )
        }
    }

    private fun restartPolling() {
        if (!started || activeVisitID == null || sessionInvalidationEmitted) {
            unreadPolling.cancel()
            mutableState.update { it.copy(isUnreadRefreshing = false) }
            return
        }
        unreadPolling.launch {
            // Lifecycle, visit and session changes cancel this slot's job.
            while (true) {
                currentCoroutineContext().ensureActive()
                mutableState.update { it.copy(isUnreadRefreshing = true, failure = null) }
                requestResult { repository.unreadCount() }.fold(
                    onSuccess = { count ->
                        mutableState.update {
                            it.copy(unreadMessageCount = count, isUnreadRefreshing = false)
                        }
                    },
                    onFailure = { error ->
                        mutableState.update { it.copy(isUnreadRefreshing = false) }
                        reportFailure(error)
                    },
                )
                currentCoroutineContext().ensureActive()
                waitForNextPoll()
            }
        }
    }


    private fun reportFailure(error: Throwable) {
        if (error.isAuthenticationFailure()) {
            if (!sessionInvalidationEmitted) {
                sessionInvalidationEmitted = true
                avatarRequest.cancel()
                unreadPolling.cancel()
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
        started = false
        activeVisitID = null
        avatarRequest.cancel()
        unreadPolling.cancel()
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
    val owner = requireNavigationViewModelStoreOwner("The member shell must be hosted by its root Navigation 3 entry.")
    val viewModel = rememberEntryViewModel(
        owner = owner,
        modelClass = MemberShellViewModel::class.java,
        factory = MemberShellViewModel.Factory(MobileApiMemberShellRepository(api, session)),
    )
    SideEffect { viewModel.onEvent(MemberShellEvent.EnvironmentChanged(api, session)) }
    return viewModel
}
