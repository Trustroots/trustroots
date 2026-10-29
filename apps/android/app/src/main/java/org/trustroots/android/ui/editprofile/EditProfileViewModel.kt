package org.trustroots.android.ui.editprofile

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import android.text.Html
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
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileUpdate
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.rememberEntryViewModel

internal interface EditProfileRepository {
    fun updateApi(api: MobileApiClient): Boolean = false
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun profile(username: String): Result<MemberProfile>
    suspend fun update(profile: ProfileUpdate): Result<MemberProfile>
}

internal class MobileApiEditProfileRepository(
    api: MobileApiClient,
    session: MemberSession,
) : EditProfileRepository {
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

    override suspend fun profile(username: String) = api.profile(session, username)
    override suspend fun update(profile: ProfileUpdate) = api.updateProfile(session, profile)
}

internal data class EditProfileFailure(
    val fallback: UiFailureFallback,
    val apiKind: ApiFailureKind? = null,
    val serverMessage: String? = null,
)

internal data class EditProfileInvalidation(val id: Long)
internal data class EditProfileSaved(val id: Long, val profile: MemberProfile)

internal data class EditProfileUiState(
    val baseline: MemberProfile? = null,
    val name: String = "",
    val tagline: String = "",
    val description: String = "",
    val living: String = "",
    val from: String = "",
    val languages: Set<String> = emptySet(),
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val failure: EditProfileFailure? = null,
    val pendingInvalidation: EditProfileInvalidation? = null,
    val pendingSave: EditProfileSaved? = null,
) {
    val isDirty: Boolean
        get() {
            val initial = baseline ?: return false
            val normalizedDescription = Html.fromHtml(initial.description.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim()
            return name != initial.displayName || tagline != initial.tagline.orEmpty() || description != normalizedDescription ||
                living != initial.locationLiving.orEmpty() || from != initial.locationFrom.orEmpty() || languages != initial.languages.toSet()
        }
}

internal sealed interface EditProfileEvent {
    data class NameChanged(val value: String) : EditProfileEvent
    data class TaglineChanged(val value: String) : EditProfileEvent
    data class DescriptionChanged(val value: String) : EditProfileEvent
    data class LivingChanged(val value: String) : EditProfileEvent
    data class FromChanged(val value: String) : EditProfileEvent
    data class LanguageToggled(val code: String) : EditProfileEvent
    data object Save : EditProfileEvent
    data class SaveDelivered(val id: Long) : EditProfileEvent
    data class InvalidationDelivered(val id: Long) : EditProfileEvent
}

internal class EditProfileViewModel(
    private val username: String,
    private val repository: EditProfileRepository,
    initialApi: MobileApiClient,
    initialSession: MemberSession,
    initialProfile: MemberProfile? = null,
    scope: CoroutineScope?,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(
        initialProfile?.toEditState() ?: EditProfileUiState(),
    )
    val state = mutableState.asStateFlow()
    private var nextInvalidationID = 0L
    private var nextSaveID = 0L
    private var invalidationEmitted = false
    private val profileRequest = LatestRequest(requestScope)
    private var backendURL = initialApi.backendURL
    private var session = initialSession

    init {
        if (initialProfile == null) load()
    }

    fun onEvent(event: EditProfileEvent) {
        when (event) {
            is EditProfileEvent.NameChanged -> mutableState.update { it.copy(name = event.value) }
            is EditProfileEvent.TaglineChanged -> mutableState.update { it.copy(tagline = event.value) }
            is EditProfileEvent.DescriptionChanged -> mutableState.update { it.copy(description = event.value) }
            is EditProfileEvent.LivingChanged -> mutableState.update { it.copy(living = event.value) }
            is EditProfileEvent.FromChanged -> mutableState.update { it.copy(from = event.value) }
            is EditProfileEvent.LanguageToggled -> mutableState.update { current ->
                current.copy(languages = if (event.code in current.languages) current.languages - event.code else current.languages + event.code)
            }
            EditProfileEvent.Save -> save()
            is EditProfileEvent.SaveDelivered -> mutableState.update { current ->
                if (current.pendingSave?.id == event.id) current.copy(pendingSave = null) else current
            }
            is EditProfileEvent.InvalidationDelivered -> mutableState.update { current ->
                if (current.pendingInvalidation?.id == event.id) current.copy(pendingInvalidation = null) else current
            }
        }
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        val backendChanged = backendURL != api.backendURL
        val accountChanged = this.session.member.username != session.member.username
        val credentialsChanged = this.session.cookieHeader != session.cookieHeader
        repository.updateApi(api)
        repository.updateSession(session)
        if (!backendChanged && !accountChanged && !credentialsChanged) return

        backendURL = api.backendURL
        this.session = session
        profileRequest.cancel()
        invalidationEmitted = false

        if (accountChanged && username != session.member.username) {
            mutableState.value = EditProfileUiState(isLoading = false)
            return
        }
        if (backendChanged || accountChanged) {
            load(beforeLoad = { EditProfileUiState(isLoading = true) })
        } else {
            load(
                beforeLoad = { current ->
                    current.copy(
                        isLoading = false,
                        isSaving = false,
                        failure = null,
                        pendingInvalidation = null,
                    )
                },
                shouldStart = { mutableState.value.baseline == null && username == this.session.member.username },
            )
        }
    }

    private fun load(
        beforeLoad: ((EditProfileUiState) -> EditProfileUiState)? = null,
        shouldStart: () -> Boolean = { true },
    ) {
        profileRequest.launch {
            if (beforeLoad != null) {
                mutableState.update(beforeLoad)
                currentCoroutineContext().ensureActive()
            }
            if (!shouldStart()) return@launch
            mutableState.update { it.copy(isLoading = true, failure = null) }
            val result = requestResult { repository.profile(username) }
            result.fold(
                onSuccess = { profile -> mutableState.value = profile.toEditState() },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update { it.copy(isLoading = false, failure = failure(UiFailureFallback.LOAD_PROFILE, error)) }
                },
            )
        }
    }

    private fun save() {
        val current = mutableState.value
        if (current.baseline == null || current.name.isBlank() || current.isSaving || current.pendingSave != null || invalidationEmitted) return
        val update = ProfileUpdate(
            displayName = current.name,
            tagline = current.tagline,
            description = current.description,
            locationLiving = current.living,
            locationFrom = current.from,
            languages = current.languages.toList(),
        )
        profileRequest.launch {
            mutableState.update { it.copy(isSaving = true, failure = null) }
            val result = requestResult { repository.update(update) }
            result.fold(
                onSuccess = { profile -> mutableState.update { state ->
                    val baseline = requireNotNull(state.baseline)
                    val savedProfile = profile.copy(
                        lastActiveAtMillis = profile.lastActiveAtMillis ?: baseline.lastActiveAtMillis,
                        replyRate = profile.replyRate ?: baseline.replyRate,
                        replyTime = profile.replyTime ?: baseline.replyTime,
                    )
                    state.copy(
                        baseline = savedProfile,
                        isSaving = false,
                        pendingSave = EditProfileSaved(++nextSaveID, savedProfile),
                    )
                } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                    else mutableState.update { it.copy(isSaving = false, failure = failure(UiFailureFallback.SAVE_PROFILE, error)) }
                },
            )
        }
    }

    private suspend fun invalidateSession() {
        currentCoroutineContext().ensureActive()
        if (invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update { it.copy(isLoading = false, isSaving = false, pendingInvalidation = EditProfileInvalidation(++nextInvalidationID)) }
    }

    private fun failure(fallback: UiFailureFallback, error: Throwable) = EditProfileFailure(
        fallback = fallback,
        apiKind = (error as? MobileApiException)?.failureKind,
        serverMessage = (error as? MobileApiException)?.serverMessage?.takeIf(String::isNotBlank),
    )


    override fun onCleared() {
        profileRequest.cancel()
        mutableState.value = EditProfileUiState(isLoading = false)
        super.onCleared()
    }

    class Factory(
        private val username: String,
        private val repository: EditProfileRepository,
        private val api: MobileApiClient,
        private val session: MemberSession,
        private val initialProfile: MemberProfile? = null,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(EditProfileViewModel::class.java))
            return EditProfileViewModel(username, repository, api, session, initialProfile, scope) as T
        }
    }
}

private fun MemberProfile.toEditState(): EditProfileUiState = EditProfileUiState(
    baseline = this,
    name = displayName,
    tagline = tagline.orEmpty(),
    description = Html.fromHtml(description.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim(),
    living = locationLiving.orEmpty(),
    from = locationFrom.orEmpty(),
    languages = languages.toSet(),
    isLoading = false,
)

@Composable
internal fun rememberEditProfileViewModel(
    api: MobileApiClient,
    session: MemberSession,
    username: String,
    initialProfile: MemberProfile? = null,
): EditProfileViewModel {
    val owner = requireNavigationViewModelStoreOwner("Edit Profile must be hosted by a Navigation 3 ViewModelStoreOwner.")
    val viewModel = rememberEntryViewModel(
        owner = owner,
        modelClass = EditProfileViewModel::class.java,
        factory = EditProfileViewModel.Factory(
            username,
            MobileApiEditProfileRepository(api, session),
            api,
            session,
            initialProfile,
        ),
        key = "EditProfileViewModel:$username",
    )
    androidx.compose.runtime.SideEffect { viewModel.updateEnvironment(api, session) }
    return viewModel
}
