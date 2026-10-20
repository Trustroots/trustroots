package org.trustroots.android.ui.editprofile

import android.text.Html
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
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
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.ProfileUpdate
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure

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
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(
        initialProfile?.toEditState() ?: EditProfileUiState(),
    )
    val state = mutableState.asStateFlow()
    private var generation = 0L
    private var nextInvalidationID = 0L
    private var nextSaveID = 0L
    private var invalidationEmitted = false
    private var requestJob: Job? = null
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
        generation++
        requestJob?.cancel()
        invalidationEmitted = false

        if (accountChanged && username != session.member.username) {
            mutableState.value = EditProfileUiState(isLoading = false)
            return
        }
        if (backendChanged || accountChanged) {
            mutableState.value = EditProfileUiState(isLoading = true)
            load()
        } else {
            mutableState.update {
                it.copy(
                    isLoading = false,
                    isSaving = false,
                    failure = null,
                    pendingInvalidation = null,
                )
            }
            if (mutableState.value.baseline == null && username == session.member.username) load()
        }
    }

    private fun load() {
        val request = ++generation
        mutableState.update { it.copy(isLoading = true, failure = null) }
        requestJob?.cancel()
        requestJob = requestScope.launch {
            val result = safe { repository.profile(username) }
            if (request != generation) return@launch
            result.fold(
                onSuccess = { profile -> mutableState.value = profile.toEditState() },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession(request)
                    else mutableState.update { it.copy(isLoading = false, failure = failure(UiFailureFallback.LOAD_PROFILE, error)) }
                },
            )
        }
    }

    private fun save() {
        val current = mutableState.value
        if (current.baseline == null || current.name.isBlank() || current.isSaving || current.pendingSave != null || invalidationEmitted) return
        val request = ++generation
        requestJob?.cancel()
        mutableState.update { it.copy(isSaving = true, failure = null) }
        val update = ProfileUpdate(
            displayName = current.name,
            tagline = current.tagline,
            description = current.description,
            locationLiving = current.living,
            locationFrom = current.from,
            languages = current.languages.toList(),
        )
        requestJob = requestScope.launch {
            val result = safe { repository.update(update) }
            if (request != generation) return@launch
            result.fold(
                onSuccess = { profile -> mutableState.update {
                    it.copy(baseline = profile, isSaving = false, pendingSave = EditProfileSaved(++nextSaveID, profile))
                } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession(request)
                    else mutableState.update { it.copy(isSaving = false, failure = failure(UiFailureFallback.SAVE_PROFILE, error)) }
                },
            )
        }
    }

    private fun invalidateSession(request: Long) {
        if (request != generation || invalidationEmitted) return
        invalidationEmitted = true
        mutableState.update { it.copy(isLoading = false, isSaving = false, pendingInvalidation = EditProfileInvalidation(++nextInvalidationID)) }
    }

    private fun failure(fallback: UiFailureFallback, error: Throwable) = EditProfileFailure(
        fallback = fallback,
        apiKind = (error as? MobileApiException)?.failureKind,
        serverMessage = (error as? MobileApiException)?.serverMessage?.takeIf(String::isNotBlank),
    )

    private suspend fun <T> safe(block: suspend () -> Result<T>): Result<T> {
        val result = try { block() } catch (cancelled: CancellationException) { throw cancelled } catch (error: Throwable) { Result.failure(error) }
        currentCoroutineContext().ensureActive()
        (result.exceptionOrNull() as? CancellationException)?.let { throw it }
        return result
    }

    override fun onCleared() {
        generation++
        requestJob?.cancel()
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
    val owner = checkNotNull(LocalViewModelStoreOwner.current) { "Edit Profile must be hosted by a Navigation 3 ViewModelStoreOwner." }
    val viewModel = remember(owner, username) {
        ViewModelProvider(
            owner,
            EditProfileViewModel.Factory(username, MobileApiEditProfileRepository(api, session), api, session, initialProfile),
        )["EditProfileViewModel:$username", EditProfileViewModel::class.java]
    }
    androidx.compose.runtime.SideEffect { viewModel.updateEnvironment(api, session) }
    return viewModel
}
