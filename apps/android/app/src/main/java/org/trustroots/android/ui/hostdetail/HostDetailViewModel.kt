package org.trustroots.android.ui.hostdetail

import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.ui.search.SearchOfferType

internal interface HostDetailRepository {
    fun updateClientAndSession(api: MobileApiClient, session: MemberSession): Boolean = false
    suspend fun offer(offerID: String): Result<HostOffer>
    suspend fun profile(username: String): Result<MemberProfile>
    suspend fun memberships(): Result<Set<String>>
}

internal class MobileHostDetailRepository(
    private var api: MobileApiClient,
    private var session: MemberSession,
) : HostDetailRepository {
    override fun updateClientAndSession(api: MobileApiClient, session: MemberSession): Boolean {
        val changed = this.api.backendURL != api.backendURL ||
            this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.api = api
        this.session = session
        return changed
    }

    override suspend fun offer(offerID: String) = api.hostOffer(session, offerID)

    override suspend fun profile(username: String) = api.profile(session, username)

    override suspend fun memberships() = api.circleMemberships(session)
}

internal data class HostDetailSessionInvalidation(val id: Long)

internal data class HostDetailUiState(
    val offerID: String? = null,
    val offerType: SearchOfferType = SearchOfferType.Host,
    val offer: HostOffer? = null,
    val profile: MemberProfile? = null,
    val sharedCircleIDs: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val failure: UiFailure? = null,
    val pendingSessionInvalidation: HostDetailSessionInvalidation? = null,
)

internal sealed interface HostDetailEvent {
    data class Load(val offerID: String, val offerType: SearchOfferType) : HostDetailEvent
    data object Retry : HostDetailEvent
    data class SessionInvalidationDelivered(val id: Long) : HostDetailEvent
}

internal class HostDetailViewModel(
    private val repository: HostDetailRepository,
    private val scope: CoroutineScope? = null,
) : ViewModel() {
    private val workScope get() = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(HostDetailUiState())
    val state = mutableState.asStateFlow()

    private var loadJob: Job? = null
    private var generation = 0L
    private var nextInvalidationID = 0L
    private var invalidationEmitted = false
    private var requestedOfferID: String? = null
    private var requestedOfferType = SearchOfferType.Host

    fun onEvent(event: HostDetailEvent) {
        when (event) {
            is HostDetailEvent.Load -> load(event.offerID, event.offerType)
            HostDetailEvent.Retry -> load(requestedOfferID ?: return, requestedOfferType, force = true)
            is HostDetailEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    fun updateClientAndSession(api: MobileApiClient, session: MemberSession) {
        if (!repository.updateClientAndSession(api, session)) return
        cancelLoad()
        invalidationEmitted = false
        mutableState.value = HostDetailUiState()
        requestedOfferID?.let { load(it, requestedOfferType, force = true) }
    }

    override fun onCleared() {
        cancelLoad()
        super.onCleared()
    }

    private fun load(offerID: String, offerType: SearchOfferType, force: Boolean = false) {
        if (offerID.isBlank() || invalidationEmitted) return
        val sameRequest = requestedOfferID == offerID && requestedOfferType == offerType
        if (!force && sameRequest && (loadJob?.isActive == true || state.value.offer != null || state.value.failure != null)) return
        requestedOfferID = offerID
        requestedOfferType = offerType
        cancelLoad()
        val requestGeneration = ++generation
        mutableState.value = HostDetailUiState(
            offerID = offerID,
            offerType = offerType,
            isLoading = true,
        )
        loadJob = workScope.launch {
            val offerResult = request { repository.offer(offerID) }
            if (requestGeneration != generation) return@launch
            offerResult.fold(
                onSuccess = { offer ->
                    mutableState.update { it.copy(offer = offer) }
                    val username = offer.user.username ?: return@launch finishLoading(requestGeneration)
                    val profileResult = request { repository.profile(username) }
                    if (requestGeneration != generation) return@launch
                    profileResult.fold(
                        onSuccess = { profile -> mutableState.update { it.copy(profile = profile) } },
                        onFailure = { handleFailure(it, UiFailureFallback.LOAD_PROFILE) },
                    )
                    if (invalidationEmitted || requestGeneration != generation) return@launch
                    val membershipsResult = request { repository.memberships() }
                    if (requestGeneration != generation) return@launch
                    membershipsResult.fold(
                        onSuccess = { memberships -> mutableState.update { it.copy(sharedCircleIDs = memberships) } },
                        onFailure = { handleFailure(it, UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD) },
                    )
                },
                onFailure = { handleFailure(it, UiFailureFallback.LOAD_HOST) },
            )
            finishLoading(requestGeneration)
        }
    }

    private suspend fun finishLoading(requestGeneration: Long) {
        if (requestGeneration == generation) mutableState.update { it.copy(isLoading = false) }
    }

    private suspend fun <T> request(block: suspend () -> Result<T>): Result<T> {
        val result = try {
            block()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            Result.failure(error)
        }
        coroutineContext.ensureActive()
        (result.exceptionOrNull() as? CancellationException)?.let { throw it }
        return result
    }

    private fun handleFailure(error: Throwable, fallback: UiFailureFallback) {
        if (error.isAuthenticationFailure()) {
            if (!invalidationEmitted) {
                invalidationEmitted = true
                mutableState.update {
                    it.copy(pendingSessionInvalidation = HostDetailSessionInvalidation(++nextInvalidationID))
                }
            }
        } else {
            mutableState.update { it.copy(failure = error.toUiFailure(fallback)) }
        }
    }

    private fun cancelLoad() {
        generation++
        loadJob?.cancel()
        loadJob = null
    }

    class Factory(
        private val repository: HostDetailRepository,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(HostDetailViewModel::class.java))
            return HostDetailViewModel(repository, scope) as T
        }
    }
}

@Composable
internal fun rememberHostDetailViewModel(
    api: MobileApiClient,
    session: MemberSession,
): HostDetailViewModel {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "HostDetail must be hosted by its Navigation 3 entry ViewModelStoreOwner"
    }
    val repository = remember(owner, api.backendURL) { MobileHostDetailRepository(api, session) }
    val factory = remember(owner, repository) { HostDetailViewModel.Factory(repository) }
    val model = viewModel<HostDetailViewModel>(viewModelStoreOwner = owner, factory = factory)
    SideEffect { model.updateClientAndSession(api, session) }
    return model
}
