package org.trustroots.android.ui.hostdetail

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
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
    private val scope: CoroutineScope?,
) : ViewModel() {
    private val workScope get() = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(HostDetailUiState())
    val state = mutableState.asStateFlow()

    private val loadRequest = LatestRequest(workScope)
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
        invalidationEmitted = false
        val offerID = requestedOfferID
        if (offerID != null) {
            load(offerID, requestedOfferType, force = true, resetState = true)
        } else {
            mutableState.value = HostDetailUiState()
        }
    }

    override fun onCleared() {
        cancelLoad()
        super.onCleared()
    }

    private fun load(
        offerID: String,
        offerType: SearchOfferType,
        force: Boolean = false,
        resetState: Boolean = false,
    ) {
        if (offerID.isBlank() || invalidationEmitted) return
        val sameRequest = requestedOfferID == offerID && requestedOfferType == offerType
        if (!force && sameRequest && (loadRequest.isActive || state.value.offer != null || state.value.failure != null)) return
        requestedOfferID = offerID
        requestedOfferType = offerType
        loadRequest.launch {
            if (resetState) {
                mutableState.value = HostDetailUiState()
            }
            currentCoroutineContext().ensureActive()
            mutableState.update {
                it.copy(offerID = offerID, offerType = offerType, isLoading = true, failure = null)
            }
            currentCoroutineContext().ensureActive()
            val offerResult = requestResult { repository.offer(offerID) }
            offerResult.fold(
                onSuccess = { offer ->
                    mutableState.update { it.copy(offer = offer) }
                    currentCoroutineContext().ensureActive()
                    val username = offer.user.username ?: return@launch finishLoading()
                    val profileResult = requestResult { repository.profile(username) }
                    profileResult.fold(
                        onSuccess = { profile -> mutableState.update { it.copy(profile = profile) } },
                        onFailure = { handleFailure(it, UiFailureFallback.LOAD_PROFILE) },
                    )
                    currentCoroutineContext().ensureActive()
                    if (invalidationEmitted) return@launch
                    val membershipsResult = requestResult { repository.memberships() }
                    membershipsResult.fold(
                        onSuccess = { memberships -> mutableState.update { it.copy(sharedCircleIDs = memberships) } },
                        onFailure = { handleFailure(it, UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD) },
                    )
                },
                onFailure = { handleFailure(it, UiFailureFallback.LOAD_HOST) },
            )
            finishLoading()
        }
    }

    private suspend fun finishLoading() {
        currentCoroutineContext().ensureActive()
        mutableState.update { it.copy(isLoading = false) }
    }

    private suspend fun handleFailure(error: Throwable, fallback: UiFailureFallback) {
        currentCoroutineContext().ensureActive()
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
        currentCoroutineContext().ensureActive()
    }

    private fun cancelLoad() {
        loadRequest.cancel()
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
    val owner = requireNavigationViewModelStoreOwner("HostDetail must be hosted by its Navigation 3 entry ViewModelStoreOwner")
    val repository = remember(owner, api.backendURL) { MobileHostDetailRepository(api, session) }
    val factory = remember(owner, repository) { HostDetailViewModel.Factory(repository) }
    val model = viewModel<HostDetailViewModel>(viewModelStoreOwner = owner, factory = factory)
    SideEffect { model.updateClientAndSession(api, session) }
    return model
}
