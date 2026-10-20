package org.trustroots.android.ui

import android.text.Html
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.toUiFailure

internal const val DEFAULT_HOST_LATITUDE = 48.6908333333
internal const val DEFAULT_HOST_LONGITUDE = 9.14055555556

internal val LocalHostOfferRepository = compositionLocalOf<HostOfferRepository?> { null }

internal data class HostOfferForm(
    val id: String? = null,
    val status: String = "yes",
    val description: String = "",
    val noOfferDescription: String = "",
    val maxGuests: Int = 1,
    val showOnlyInMyCircles: Boolean = false,
    val latitude: Double = DEFAULT_HOST_LATITUDE,
    val longitude: Double = DEFAULT_HOST_LONGITUDE,
) {
    fun toUpdate(): HostOfferUpdate = HostOfferUpdate(
        id = id,
        status = status,
        description = description,
        noOfferDescription = noOfferDescription,
        maxGuests = maxGuests,
        showOnlyInMyCircles = showOnlyInMyCircles,
        latitude = latitude,
        longitude = longitude,
    )
}

internal fun interface HostOfferDescriptionDecoder {
    fun decode(value: String?): String
}

internal object AndroidHostOfferDescriptionDecoder : HostOfferDescriptionDecoder {
    override fun decode(value: String?): String =
        Html.fromHtml(value.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim()
}

internal interface HostOfferRepository {
    suspend fun load(): Result<HostOfferForm>
    suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer>
}

/** The live session stays in this entry-scoped adapter, outside saved UI state and navigation keys. */
internal class MobileApiHostOfferRepository(
    private val api: MobileApiClient,
    private val session: MemberSession,
    private val descriptionDecoder: HostOfferDescriptionDecoder = AndroidHostOfferDescriptionDecoder,
) : HostOfferRepository {
    override suspend fun load(): Result<HostOfferForm> {
        val profile = api.profile(session, session.member.username).getOrElse { return Result.failure(it) }
        val memberID = profile.id ?: return Result.failure(MissingHostOfferMemberID())
        val offer = api.accommodationOffer(session, memberID).getOrElse { return Result.failure(it) }
        return Result.success(offer?.toForm() ?: HostOfferForm())
    }

    override suspend fun save(update: HostOfferUpdate): Result<AccommodationOffer> =
        api.saveHostOffer(session, update)

    private fun AccommodationOffer.toForm(): HostOfferForm = HostOfferForm(
        id = id,
        status = status ?: "yes",
        description = descriptionDecoder.decode(description),
        noOfferDescription = descriptionDecoder.decode(noOfferDescription),
        maxGuests = maxGuests ?: 1,
        showOnlyInMyCircles = showOnlyInMyCircles,
        latitude = latitude ?: DEFAULT_HOST_LATITUDE,
        longitude = longitude ?: DEFAULT_HOST_LONGITUDE,
    )
}

private class MissingHostOfferMemberID : Exception()

internal data class HostOfferSessionInvalidation(val id: Long)

internal data class HostOfferUiState(
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val form: HostOfferForm = HostOfferForm(),
    val original: HostOfferUpdate? = null,
    val failure: UiFailure? = null,
    val saveSucceeded: Boolean = false,
    val pendingSessionInvalidation: HostOfferSessionInvalidation? = null,
) {
    val current: HostOfferUpdate get() = form.toUpdate()
    val isDirty: Boolean get() = original != null && current != original
    val descriptionTooShort: Boolean get() = form.status != "no" && form.description.trim().length < 5
    val canSave: Boolean
        get() = !isLoading && !isSaving && original != null && !descriptionTooShort && pendingSessionInvalidation == null
}

internal sealed interface HostOfferEvent {
    data class StatusChanged(val value: String) : HostOfferEvent
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
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(HostOfferUiState())
    val state = mutableState.asStateFlow()

    private var loadGeneration = 0L
    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var loadJob: Job? = null
    private var saveJob: Job? = null

    init {
        load()
    }

    fun onEvent(event: HostOfferEvent) {
        when (event) {
            is HostOfferEvent.StatusChanged -> edit { copy(status = event.value) }
            is HostOfferEvent.DescriptionChanged -> edit { copy(description = event.value) }
            is HostOfferEvent.NoOfferDescriptionChanged -> edit { copy(noOfferDescription = event.value) }
            is HostOfferEvent.MaximumGuestsChanged -> edit {
                val parsed = event.value.filter(Char::isDigit).toIntOrNull()
                copy(maxGuests = parsed?.coerceIn(1, 20) ?: maxGuests)
            }
            is HostOfferEvent.ShowOnlyInMyCirclesChanged -> edit { copy(showOnlyInMyCircles = event.value) }
            HostOfferEvent.RetryLoad -> if (mutableState.value.original == null) load()
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

    private fun load() {
        if (sessionInvalidationEmitted || mutableState.value.isSaving) return
        val generation = ++loadGeneration
        loadJob?.cancel()
        mutableState.update { it.copy(isLoading = true, failure = null, saveSucceeded = false) }
        loadJob = requestScope.launch {
            val result = request { repository.load() }
            if (generation != loadGeneration) return@launch
            result.fold(
                onSuccess = { loaded ->
                    val baseline = loaded.toUpdate()
                    mutableState.value = HostOfferUiState(
                        isLoading = false,
                        form = loaded,
                        original = baseline,
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
        if (sessionInvalidationEmitted || beforeSave.pendingSessionInvalidation != null ||
            !beforeSave.canSave || beforeSave.isSaving
        ) return
        val submitted = beforeSave.current
        val generation = loadGeneration
        mutableState.update { it.copy(isSaving = true, failure = null, saveSucceeded = false) }
        saveJob = requestScope.launch {
            val result = request { repository.save(submitted) }
            if (generation != loadGeneration) return@launch
            result.fold(
                onSuccess = { saved ->
                    mutableState.update { current ->
                        current.copy(
                            isSaving = false,
                            form = current.form.copy(id = saved.id),
                            original = submitted.copy(id = saved.id),
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
        if (sessionInvalidationEmitted) return
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

    override fun onCleared() {
        ++loadGeneration
        loadJob?.cancel()
        saveJob?.cancel()
        mutableState.value = HostOfferUiState(isLoading = false)
        super.onCleared()
    }

    class Factory(
        private val repository: HostOfferRepository,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(HostOfferViewModel::class.java))
            return HostOfferViewModel(repository, scope) as T
        }
    }
}

@Composable
internal fun rememberHostOfferViewModel(
    api: MobileApiClient,
    session: MemberSession,
): HostOfferViewModel {
    val owner: ViewModelStoreOwner = checkNotNull(LocalViewModelStoreOwner.current) {
        "Host offer screen must be hosted by its Navigation 3 entry."
    }
    val repositoryOverride = LocalHostOfferRepository.current
    val repository = remember(owner, api, session.member.username, repositoryOverride) {
        repositoryOverride ?: MobileApiHostOfferRepository(api, session)
    }
    val factory = remember(owner, repository) {
        HostOfferViewModel.Factory(repository)
    }
    return remember(owner, factory) {
        ViewModelProvider(owner, factory).get(HostOfferViewModel::class.java)
    }
}
