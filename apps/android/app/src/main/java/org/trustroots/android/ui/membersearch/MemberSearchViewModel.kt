package org.trustroots.android.ui.membersearch

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
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
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.isAuthenticationFailure

internal fun interface MemberSearchRepository {
    suspend fun searchMembers(query: String): Result<List<MemberProfile>>
}

/** Holds the current session only in memory for requests owned by this Search entry. */
internal class MobileApiMemberSearchRepository(
    private val api: MobileApiClient,
    private val session: MemberSession,
) : MemberSearchRepository {
    override suspend fun searchMembers(query: String): Result<List<MemberProfile>> =
        api.searchMembers(session, query)
}

internal enum class MemberSearchFailureKind {
    SEARCH,
}

internal data class MemberSearchFailure(
    val kind: MemberSearchFailureKind,
    val serverMessage: String?,
)

internal data class MemberSearchSessionInvalidation(val id: Long)

internal data class MemberSearchUiState(
    val query: String = "",
    val results: List<MemberProfile> = emptyList(),
    val isLoading: Boolean = false,
    val hasSearched: Boolean = false,
    val failure: MemberSearchFailure? = null,
    val resultScrollOffset: Int = 0,
    val pendingSessionInvalidation: MemberSearchSessionInvalidation? = null,
)

internal sealed interface MemberSearchEvent {
    data class QueryChanged(val value: String) : MemberSearchEvent
    data object Submit : MemberSearchEvent
    data class Reset(val generation: Int? = null) : MemberSearchEvent
    data class ResultsScrolled(val offset: Int) : MemberSearchEvent
    data class SessionInvalidationDelivered(val id: Long) : MemberSearchEvent
}

internal class MemberSearchViewModel(
    private val repository: MemberSearchRepository,
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(MemberSearchUiState())
    val state = mutableState.asStateFlow()

    private var requestGeneration = 0L
    private var nextInvalidationID = 0L
    private var lastResetGeneration = 0
    private var sessionInvalidationEmitted = false
    private var searchJob: Job? = null

    fun onEvent(event: MemberSearchEvent) {
        when (event) {
            is MemberSearchEvent.QueryChanged -> updateQuery(event.value)
            MemberSearchEvent.Submit -> submit()
            is MemberSearchEvent.Reset -> {
                val generation = event.generation
                if (generation == null || generation > lastResetGeneration) {
                    if (generation != null) lastResetGeneration = generation
                    reset()
                }
            }
            is MemberSearchEvent.ResultsScrolled -> mutableState.update {
                it.copy(resultScrollOffset = event.offset.coerceAtLeast(0))
            }
            is MemberSearchEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    private fun updateQuery(value: String) {
        requestGeneration++
        mutableState.update {
            it.copy(
                query = value,
                results = emptyList(),
                hasSearched = false,
                failure = null,
                resultScrollOffset = 0,
            )
        }
    }

    private fun submit() {
        val current = mutableState.value
        if (sessionInvalidationEmitted || current.query.trim().length < MIN_QUERY_LENGTH || current.isLoading) return

        val generation = ++requestGeneration
        searchJob?.cancel()
        mutableState.update { it.copy(isLoading = true, failure = null) }
        val submittedQuery = current.query
        searchJob = requestScope.launch {
            val result = request { repository.searchMembers(submittedQuery) }
            val requestFailure = result.exceptionOrNull()
            if (requestFailure?.isAuthenticationFailure() == true) {
                emitSessionInvalidation()
                mutableState.update { it.copy(isLoading = false) }
                return@launch
            }
            if (generation != requestGeneration) {
                mutableState.update { if (it.isLoading) it.copy(isLoading = false) else it }
                return@launch
            }
            result.fold(
                onSuccess = { members ->
                    mutableState.update {
                        it.copy(
                            results = members.toList(),
                            isLoading = false,
                            hasSearched = true,
                            resultScrollOffset = 0,
                        )
                    }
                },
                onFailure = { error ->
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            failure = MemberSearchFailure(MemberSearchFailureKind.SEARCH, error.message),
                        )
                    }
                },
            )
        }
    }

    private fun reset() {
        invalidateSearch()
        mutableState.value = MemberSearchUiState()
    }

    private fun invalidateSearch() {
        requestGeneration++
        searchJob?.cancel()
        searchJob = null
    }

    private fun emitSessionInvalidation() {
        if (sessionInvalidationEmitted) return
        sessionInvalidationEmitted = true
        val invalidation = MemberSearchSessionInvalidation(++nextInvalidationID)
        mutableState.update { it.copy(pendingSessionInvalidation = invalidation) }
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
        invalidateSearch()
        mutableState.value = MemberSearchUiState()
        super.onCleared()
    }

    class Factory(
        private val repository: MemberSearchRepository,
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(MemberSearchViewModel::class.java))
            return MemberSearchViewModel(repository, scope = scope) as T
        }
    }

    private companion object {
        const val MIN_QUERY_LENGTH = 3
    }
}

@Composable
internal fun rememberMemberSearchViewModel(
    api: MobileApiClient,
    session: MemberSession,
): MemberSearchViewModel {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "Member search must be hosted by a Navigation 3 ViewModelStoreOwner."
    }
    return remember(owner, api, session) { owner.memberSearchViewModel(api, session) }
}

internal fun ViewModelStoreOwner.memberSearchViewModel(
    api: MobileApiClient,
    session: MemberSession,
): MemberSearchViewModel = ViewModelProvider(
    this,
    MemberSearchViewModel.Factory(MobileApiMemberSearchRepository(api, session)),
)[MemberSearchViewModel::class.java]
