package org.trustroots.android.ui.experience

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.runtime.Composable
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
import org.trustroots.android.api.ExperienceCreate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.rememberEntryViewModel

internal fun interface CreateExperienceRepository {
    fun updateApi(api: MobileApiClient): Boolean = false
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun create(experience: ExperienceCreate): Result<Unit>
}

internal class MobileApiCreateExperienceRepository(
    api: MobileApiClient,
    session: MemberSession,
) : CreateExperienceRepository {
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

    override suspend fun create(experience: ExperienceCreate) = api.createExperience(session, experience)
}

internal data class CreateExperienceFailure(
    val apiKind: ApiFailureKind? = null,
    val serverMessage: String? = null,
)

internal data class CreateExperienceInvalidation(val id: Long)
internal data class ExperienceCreated(val id: Long)

internal data class CreateExperienceUiState(
    val met: Boolean = true,
    val hosted: Boolean = false,
    val wasGuest: Boolean = false,
    val recommendation: String = "yes",
    val feedback: String = "",
    val isSaving: Boolean = false,
    val failure: CreateExperienceFailure? = null,
    val pendingInvalidation: CreateExperienceInvalidation? = null,
    val pendingSuccess: ExperienceCreated? = null,
) {
    val canSave: Boolean get() = met || hosted || wasGuest
    val isDirty: Boolean
        get() = !met || hosted || wasGuest || recommendation != "yes" || feedback.isNotEmpty()
}

internal sealed interface CreateExperienceEvent {
    data class MetChanged(val value: Boolean) : CreateExperienceEvent
    data class HostedChanged(val value: Boolean) : CreateExperienceEvent
    data class WasGuestChanged(val value: Boolean) : CreateExperienceEvent
    data class RecommendationChanged(val value: String) : CreateExperienceEvent
    data class FeedbackChanged(val value: String) : CreateExperienceEvent
    data object Submit : CreateExperienceEvent
    data class SuccessDelivered(val id: Long) : CreateExperienceEvent
    data class InvalidationDelivered(val id: Long) : CreateExperienceEvent
}

internal class CreateExperienceViewModel(
    private val memberID: String,
    private val repository: CreateExperienceRepository,
    initialApi: MobileApiClient,
    initialSession: MemberSession,
    scope: CoroutineScope?,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(CreateExperienceUiState())
    val state = mutableState.asStateFlow()
    private var nextInvalidationID = 0L
    private var nextSuccessID = 0L
    private var invalidationEmitted = false
    private val createRequest = LatestRequest(requestScope)
    private var backendURL = initialApi.backendURL
    private var session = initialSession

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        val backendChanged = backendURL != api.backendURL
        val accountChanged = this.session.member.username != session.member.username
        val credentialsChanged = this.session.cookieHeader != session.cookieHeader
        repository.updateApi(api)
        repository.updateSession(session)
        if (!backendChanged && !accountChanged && !credentialsChanged) return

        backendURL = api.backendURL
        this.session = session
        createRequest.cancel()
        invalidationEmitted = false
        if (backendChanged || accountChanged) {
            mutableState.value = CreateExperienceUiState()
        } else {
            mutableState.update {
                it.copy(
                    isSaving = false,
                    failure = null,
                    pendingInvalidation = null,
                )
            }
        }
    }

    fun onEvent(event: CreateExperienceEvent) {
        when (event) {
            is CreateExperienceEvent.MetChanged -> mutableState.update { it.copy(met = event.value) }
            is CreateExperienceEvent.HostedChanged -> mutableState.update { it.copy(hosted = event.value) }
            is CreateExperienceEvent.WasGuestChanged -> mutableState.update { it.copy(wasGuest = event.value) }
            is CreateExperienceEvent.RecommendationChanged -> mutableState.update { it.copy(recommendation = event.value) }
            is CreateExperienceEvent.FeedbackChanged -> mutableState.update { it.copy(feedback = event.value) }
            CreateExperienceEvent.Submit -> submit()
            is CreateExperienceEvent.SuccessDelivered -> mutableState.update { current ->
                if (current.pendingSuccess?.id == event.id) current.copy(pendingSuccess = null) else current
            }
            is CreateExperienceEvent.InvalidationDelivered -> mutableState.update { current ->
                if (current.pendingInvalidation?.id == event.id) current.copy(pendingInvalidation = null) else current
            }
        }
    }

    private fun submit() {
        val current = mutableState.value
        if (!current.canSave || current.isSaving || current.pendingSuccess != null || invalidationEmitted) return
        val experience = ExperienceCreate(
            userTo = memberID,
            met = current.met,
            guest = current.wasGuest,
            host = current.hosted,
            recommend = current.recommendation,
            feedbackPublic = current.feedback,
        )
        createRequest.launch {
            mutableState.update { it.copy(isSaving = true, failure = null) }
            val result = requestResult { repository.create(experience) }
            result.fold(
                onSuccess = { mutableState.update { it.copy(isSaving = false, pendingSuccess = ExperienceCreated(++nextSuccessID)) } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update { it.copy(isSaving = false, failure = failure(error)) }
                },
            )
        }
    }

    private suspend fun invalidateSession() {
        currentCoroutineContext().ensureActive()
        if (invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update { it.copy(isSaving = false, pendingInvalidation = CreateExperienceInvalidation(++nextInvalidationID)) }
    }

    private fun failure(error: Throwable) = CreateExperienceFailure(
        apiKind = (error as? MobileApiException)?.failureKind,
        serverMessage = (error as? MobileApiException)?.serverMessage?.takeIf(String::isNotBlank),
    )


    override fun onCleared() {
        createRequest.cancel()
        mutableState.value = CreateExperienceUiState()
        super.onCleared()
    }

    class Factory(
        private val memberID: String,
        private val repository: CreateExperienceRepository,
        private val api: MobileApiClient,
        private val session: MemberSession,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(CreateExperienceViewModel::class.java))
            return CreateExperienceViewModel(memberID, repository, api, session, scope) as T
        }
    }
}

@Composable
internal fun rememberCreateExperienceViewModel(
    api: MobileApiClient,
    session: MemberSession,
    memberID: String,
): CreateExperienceViewModel {
    val owner = requireNavigationViewModelStoreOwner("Experience creation must be hosted by a Navigation 3 ViewModelStoreOwner.")
    val viewModel = rememberEntryViewModel(
        owner = owner,
        modelClass = CreateExperienceViewModel::class.java,
        factory = CreateExperienceViewModel.Factory(
            memberID,
            MobileApiCreateExperienceRepository(api, session),
            api,
            session,
        ),
        key = "CreateExperienceViewModel:$memberID",
    )
    androidx.compose.runtime.SideEffect { viewModel.updateEnvironment(api, session) }
    return viewModel
}
