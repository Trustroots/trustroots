package org.trustroots.android.ui.hostoffer

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import android.text.Html
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.isValidHostOfferLocation
import org.trustroots.android.ui.common.LatestRequest
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.toUiFailure

internal val LocalHostOfferRepository = compositionLocalOf<HostOfferRepository?> { null }

internal data class HostOfferForm(
    val id: String? = null,
    val status: String = "yes",
    val description: String = "",
    val noOfferDescription: String = "",
    val maxGuests: Int = 1,
    val showOnlyInMyCircles: Boolean = false,
    val latitude: String = "",
    val longitude: String = "",
    val meetingStatus: String = "not-set",
    val volunteering: Boolean = false,
    val savedDescription: SavedHostDescription? = null,
    val savedNoOfferDescription: SavedHostDescription? = null,
) {
    private val latitudeValue get() = latitude.trim().toDoubleOrNull() ?: Double.NaN
    private val longitudeValue get() = longitude.trim().toDoubleOrNull() ?: Double.NaN
    val locationValid get() = isValidHostOfferLocation(latitudeValue, longitudeValue)

    fun toUpdate(): HostOfferUpdate = HostOfferUpdate(
        id = id,
        status = status,
        description = savedDescription?.valueFor(description) ?: description,
        noOfferDescription = savedNoOfferDescription?.valueFor(noOfferDescription) ?: noOfferDescription,
        maxGuests = maxGuests,
        showOnlyInMyCircles = showOnlyInMyCircles,
        latitude = latitudeValue,
        longitude = longitudeValue,
        meetingStatus = meetingStatus,
        volunteering = volunteering,
    )
}

internal data class SavedHostDescription(val source: String, val editable: String) {
    fun valueFor(text: String): String = if (text == editable) source else text
}

internal fun interface HostOfferDescriptionDecoder {
    fun decode(value: String?): String
}

internal object AndroidHostOfferDescriptionDecoder : HostOfferDescriptionDecoder {
    override fun decode(value: String?): String =
        Html.fromHtml(value.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim()
}

internal interface HostOfferRepository {
    fun updateApi(api: MobileApiClient): Boolean = false
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun load(): Result<HostOfferForm>
    suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer>
}

/** The live session stays in this entry-scoped adapter, outside saved UI state and navigation keys. */
internal class MobileApiHostOfferRepository(
    api: MobileApiClient,
    session: MemberSession,
    private val descriptionDecoder: HostOfferDescriptionDecoder = AndroidHostOfferDescriptionDecoder,
) : HostOfferRepository {
    private var api = api
    private var session = session
    private var memberID: String? = null
    private var attemptedCreation = false

    override fun updateApi(api: MobileApiClient): Boolean {
        val changedBackend = this.api.backendURL != api.backendURL
        this.api = api
        if (changedBackend) clearOfferIdentity()
        return changedBackend
    }

    override fun updateSession(session: MemberSession): Boolean {
        val changedAccount = this.session.member.username != session.member.username
        val changed = this.session.credentialKey != session.credentialKey || changedAccount
        this.session = session
        if (changedAccount) clearOfferIdentity()
        return changed
    }

    override suspend fun load(): Result<HostOfferForm> {
        val activeApi = api
        val activeSession = session
        val profile = activeApi.profile(activeSession, activeSession.member.username).getOrElse { return Result.failure(it) }
        val memberID = profile.id ?: return Result.failure(MissingHostOfferMemberID())
        val offer = activeApi.accommodationOffer(activeSession, memberID, allowSaved = false)
            .getOrElse { return Result.failure(it) }
        currentCoroutineContext().ensureActive()
        this.memberID = memberID
        return Result.success(offer?.toForm() ?: HostOfferForm())
    }

    override suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer> {
        val activeApi = api
        val activeSession = session
        val offerID = if (update.id == null && attemptedCreation) {
            val memberID = memberID ?: return Result.failure(MissingHostOfferMemberID())
            // A successful create can lose its response before the app receives the ID.
            activeApi.accommodationOffer(activeSession, memberID, allowSaved = false)
                .getOrElse { return Result.failure(it) }?.id
        } else {
            update.id
        }
        currentCoroutineContext().ensureActive()
        if (offerID == null) attemptedCreation = true
        return activeApi.saveHostOffer(activeSession, update.copy(id = offerID))
            .map { saved -> saved.copy(id = saved.id ?: offerID) }
    }

    private fun clearOfferIdentity() {
        memberID = null
        attemptedCreation = false
    }

    private fun AccommodationOffer.toForm(): HostOfferForm {
        val editableDescription = descriptionDecoder.decode(description)
        val editableNoOfferDescription = descriptionDecoder.decode(noOfferDescription)
        return HostOfferForm(
            id = id,
            status = status ?: "yes",
            description = editableDescription,
            noOfferDescription = editableNoOfferDescription,
            maxGuests = maxGuests ?: 1,
            showOnlyInMyCircles = showOnlyInMyCircles,
            latitude = latitude?.toString().orEmpty(),
            longitude = longitude?.toString().orEmpty(),
            meetingStatus = meetingStatus?.takeIf { it in setOf("yes", "maybe", "no", "not-set") } ?: "not-set",
            volunteering = volunteering,
            savedDescription = description?.let { SavedHostDescription(it, editableDescription) },
            savedNoOfferDescription = noOfferDescription?.let { SavedHostDescription(it, editableNoOfferDescription) },
        )
    }
}

private class MissingHostOfferMemberID : Exception()

internal data class HostOfferSessionInvalidation(val id: Long)

internal data class HostOfferUiState(
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val form: HostOfferForm = HostOfferForm(),
    val savedForm: HostOfferForm? = null,
    val failure: UiFailure? = null,
    val saveSucceeded: Boolean = false,
    val pendingSessionInvalidation: HostOfferSessionInvalidation? = null,
) {
    val current: HostOfferUpdate get() = form.toUpdate()
    val isDirty: Boolean get() = savedForm != null && form != savedForm
    val descriptionTooShort: Boolean get() = form.status != "no" && form.description.trim().length < 5
    val canSave: Boolean
        get() = !isLoading && !isSaving && savedForm != null && !descriptionTooShort && form.locationValid && pendingSessionInvalidation == null
}

internal sealed interface HostOfferEvent {
    data class StatusChanged(val value: String) : HostOfferEvent
    data class MeetingStatusChanged(val value: String) : HostOfferEvent
    data class LatitudeChanged(val value: String) : HostOfferEvent
    data class LongitudeChanged(val value: String) : HostOfferEvent
    data class VolunteeringChanged(val value: Boolean) : HostOfferEvent
    data class DescriptionChanged(val value: String) : HostOfferEvent
    data class NoOfferDescriptionChanged(val value: String) : HostOfferEvent
    data class MaximumGuestsChanged(val value: String) : HostOfferEvent
    data class ShowOnlyInMyCirclesChanged(val value: Boolean) : HostOfferEvent
    data object RetryLoad : HostOfferEvent
    data object Save : HostOfferEvent
    data class SessionInvalidationDelivered(val id: Long) : HostOfferEvent
}

internal class HostOfferViewModel(
    private val repository: HostOfferRepository,
    scope: CoroutineScope?,
    initialApi: MobileApiClient? = null,
    initialSession: MemberSession? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(HostOfferUiState())
    val state = mutableState.asStateFlow()

    private val loadRequest = LatestRequest(requestScope)
    private val saveRequest = LatestRequest(requestScope)
    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var backendURL: String? = initialApi?.backendURL
    private var username: String? = initialSession?.let { it.member.username }
    private var credentialKey: String? = initialSession?.credentialKey

    init {
        initialApi?.let(repository::updateApi)
        initialSession?.let(repository::updateSession)
        load()
    }

    fun updateEnvironment(api: MobileApiClient, session: MemberSession) {
        val backendChanged = backendURL != api.backendURL
        val accountChanged = username != session.member.username
        val credentialsChanged = credentialKey != session.credentialKey
        val environmentChanged = backendChanged || accountChanged || credentialsChanged
        repository.updateApi(api)
        repository.updateSession(session)
        if (!environmentChanged) return

        backendURL = api.backendURL
        username = session.member.username
        credentialKey = session.credentialKey
        sessionInvalidationEmitted = false

        if (backendChanged || accountChanged) {
            saveRequest.cancel()
            load(resetState = true)
        } else {
            loadRequest.cancel()
            saveRequest.cancel()
            mutableState.update { current ->
                current.copy(
                    isLoading = false,
                    isSaving = false,
                    failure = if (current.savedForm == null) {
                        UiFailure(fallback = UiFailureFallback.HOST_OFFER_LOAD)
                    } else {
                        null
                    },
                    saveSucceeded = false,
                    pendingSessionInvalidation = null,
                )
            }
        }
    }

    fun onEvent(event: HostOfferEvent) {
        when (event) {
            is HostOfferEvent.StatusChanged -> edit { copy(status = event.value) }
            is HostOfferEvent.MeetingStatusChanged -> edit { copy(meetingStatus = event.value) }
            is HostOfferEvent.LatitudeChanged -> edit { copy(latitude = event.value) }
            is HostOfferEvent.LongitudeChanged -> edit { copy(longitude = event.value) }
            is HostOfferEvent.VolunteeringChanged -> edit { copy(volunteering = event.value) }
            is HostOfferEvent.DescriptionChanged -> edit { copy(description = event.value) }
            is HostOfferEvent.NoOfferDescriptionChanged -> edit { copy(noOfferDescription = event.value) }
            is HostOfferEvent.MaximumGuestsChanged -> edit {
                val parsed = event.value.filter(Char::isDigit).toIntOrNull()
                copy(maxGuests = parsed?.coerceIn(0, 99) ?: maxGuests)
            }
            is HostOfferEvent.ShowOnlyInMyCirclesChanged -> edit { copy(showOnlyInMyCircles = event.value) }
            HostOfferEvent.RetryLoad -> if (mutableState.value.savedForm == null) load()
            HostOfferEvent.Save -> save()
            is HostOfferEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    private inline fun edit(transform: HostOfferForm.() -> HostOfferForm) {
        mutableState.update { current ->
            if (current.isLoading || current.isSaving || current.pendingSessionInvalidation != null) current
            else current.copy(form = current.form.transform(), failure = null, saveSucceeded = false)
        }
    }

    private fun load(resetState: Boolean = false) {
        if (sessionInvalidationEmitted) return
        loadRequest.launch {
            if (resetState) {
                mutableState.value = HostOfferUiState(isLoading = true)
            } else {
                mutableState.update { it.copy(isLoading = true, failure = null, saveSucceeded = false) }
            }
            currentCoroutineContext().ensureActive()
            val result = requestResult { repository.load() }
            result.fold(
                onSuccess = { loaded ->
                    mutableState.value = HostOfferUiState(
                        isLoading = false,
                        form = loaded,
                        savedForm = loaded,
                    )
                },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) emitSessionInvalidation()
                    else mutableState.update {
                        it.copy(isLoading = false, failure = error.toUiFailure(UiFailureFallback.HOST_OFFER_LOAD))
                    }
                },
            )
        }
    }

    private fun save() {
        val beforeSave = mutableState.value
        if (sessionInvalidationEmitted || !beforeSave.canSave) return
        val submitted = beforeSave.current
        saveRequest.launch {
            mutableState.update { it.copy(isSaving = true, failure = null, saveSucceeded = false) }
            currentCoroutineContext().ensureActive()
            val result = requestResult { repository.save(submitted) }
            result.fold(
                onSuccess = { saved ->
                    val offerID = saved.id ?: submitted.id
                    val savedForm = beforeSave.form.copy(id = offerID)
                    mutableState.update { current ->
                        current.copy(
                            isSaving = false,
                            form = savedForm,
                            savedForm = savedForm,
                            saveSucceeded = true,
                            failure = null,
                        )
                    }
                },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) emitSessionInvalidation(isSaving = false)
                    else mutableState.update {
                        it.copy(isSaving = false, failure = error.toUiFailure(UiFailureFallback.HOST_OFFER_SAVE))
                    }
                },
            )
        }
    }

    private fun emitSessionInvalidation(isSaving: Boolean = mutableState.value.isSaving) {
        sessionInvalidationEmitted = true
        val invalidation = HostOfferSessionInvalidation(++nextInvalidationID)
        mutableState.update {
            it.copy(
                isLoading = false,
                isSaving = isSaving,
                failure = null,
                pendingSessionInvalidation = invalidation,
            )
        }
    }


    override fun onCleared() {
        loadRequest.cancel()
        saveRequest.cancel()
        mutableState.value = HostOfferUiState(isLoading = false)
        super.onCleared()
    }

    class Factory(
        private val repository: HostOfferRepository,
        private val scope: CoroutineScope? = null,
        private val initialApi: MobileApiClient? = null,
        private val initialSession: MemberSession? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(HostOfferViewModel::class.java))
            return HostOfferViewModel(repository, scope, initialApi, initialSession) as T
        }
    }
}

@Composable
internal fun rememberHostOfferViewModel(
    api: MobileApiClient,
    session: MemberSession,
): HostOfferViewModel {
    val owner: ViewModelStoreOwner = requireNavigationViewModelStoreOwner("Host offer screen must be hosted by its Navigation 3 entry.")
    val repositoryOverride = LocalHostOfferRepository.current
    val repository = remember(owner, repositoryOverride) {
        repositoryOverride ?: MobileApiHostOfferRepository(api, session)
    }
    val factory = remember(owner, repository, api, session) {
        HostOfferViewModel.Factory(repository, initialApi = api, initialSession = session)
    }
    val viewModel = rememberEntryViewModel(owner, HostOfferViewModel::class.java, factory)
    androidx.compose.runtime.SideEffect { viewModel.updateEnvironment(api, session) }
    return viewModel
}
