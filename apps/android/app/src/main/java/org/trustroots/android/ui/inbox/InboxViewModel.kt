package org.trustroots.android.ui.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.toUiFailure

internal interface InboxRepository {
    /** Replaces the in-memory credentials used by later requests. */
    fun updateSession(session: MemberSession): Boolean = false
    fun updateApi(api: MobileApiClient): Boolean = false
    suspend fun page(page: Int): Result<List<MessageThread>>
}

internal class MobileApiInboxRepository(
    api: MobileApiClient,
    session: MemberSession,
) : InboxRepository {
    private var api = api
    private var session = session

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override fun updateApi(api: MobileApiClient): Boolean {
        val changed = this.api.backendURL != api.backendURL
        this.api = api
        return changed
    }

    override suspend fun page(page: Int): Result<List<MessageThread>> = api.inbox(session, page)
}

internal data class InboxSessionInvalidation(val id: Long)

/** Short-lived data shared across tab visits, without sharing their UI or request state. */
internal class InboxCache {
    var threads: List<MessageThread>? = null
    var loadedAt: Long? = null

    fun clear() {
        threads = null
        loadedAt = null
    }
}

internal data class InboxUiState(
    val threads: List<MessageThread> = emptyList(),
    val filter: String = "",
    val isLoading: Boolean = false,
    val hasLoaded: Boolean = false,
    val nextPage: Int = 1,
    val failedPage: Int? = null,
    val replaceThreadsOnPageOne: Boolean = false,
    val failure: UiFailure? = null,
    val pendingSessionInvalidation: InboxSessionInvalidation? = null,
) {
    val visibleThreads: List<MessageThread>
        get() {
            val query = filter.trim()
            if (query.isEmpty()) return threads
            return threads.filter { thread ->
                val other = thread.otherMember
                val label = other.displayName.takeIf(String::isNotBlank)
                    ?: other.username.orEmpty()
                "$label ${other.username.orEmpty()} ${thread.excerpt}"
                    .contains(query, ignoreCase = true)
            }
        }
}

internal sealed interface InboxEvent {
    data class FilterChanged(val value: String) : InboxEvent
    data object Opened : InboxEvent
    data object Retry : InboxEvent
    data object ReturnFromConversation : InboxEvent
    data class SessionChanged(val session: MemberSession) : InboxEvent
    data class SessionInvalidationDelivered(val id: Long) : InboxEvent
}

internal class InboxViewModel(
    private val repository: InboxRepository,
    initialSession: MemberSession,
    scope: CoroutineScope?,
    private val now: () -> Long = android.os.SystemClock::elapsedRealtime,
    private val cache: InboxCache = InboxCache(),
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(InboxUiState(
        threads = cache.threads.orEmpty(),
        hasLoaded = cache.threads != null,
    ))
    val state = mutableState.asStateFlow()

    private var session = initialSession
    private var requestGeneration = 0L
    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var loadJob: Job? = null
    private var lastLoadedAt: Long? = cache.loadedAt
    private var displayed = false

    init {
        onEvent(InboxEvent.Opened)
    }

    fun onDisplayed() {
        // Construction starts the initial load; only later displays need a freshness check.
        if (displayed) onEvent(InboxEvent.Opened) else displayed = true
    }

    fun onEvent(event: InboxEvent) {
        when (event) {
            is InboxEvent.FilterChanged -> mutableState.update { it.copy(filter = event.value) }
            InboxEvent.Opened -> {
                val loadedAt = lastLoadedAt
                if (!mutableState.value.isLoading && (loadedAt == null || now() - loadedAt >= 30_000L)) load(restart = true, force = true)
            }
            InboxEvent.Retry -> load(restart = false, force = true)
            InboxEvent.ReturnFromConversation -> load(restart = true, force = true)
            is InboxEvent.SessionChanged -> updateSession(event.session)
            is InboxEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) {
                    current.copy(pendingSessionInvalidation = null)
                } else current
            }
        }
    }

    fun updateApi(api: MobileApiClient) {
        if (!repository.updateApi(api)) return
        refreshForEnvironmentChange(resetFilter = false)
    }

    private fun updateSession(newSession: MemberSession) {
        if (session.cookieHeader == newSession.cookieHeader &&
            session.member.username == newSession.member.username
        ) return

        val accountChanged = session.member.username != newSession.member.username
        session = newSession
        repository.updateSession(newSession)
        refreshForEnvironmentChange(resetFilter = accountChanged)
    }

    private fun refreshForEnvironmentChange(resetFilter: Boolean) {
        requestGeneration++
        loadJob?.cancel()
        sessionInvalidationEmitted = false
        lastLoadedAt = null
        cache.clear()
        mutableState.value = InboxUiState(
            filter = if (resetFilter) "" else mutableState.value.filter,
        )
        load(restart = true)
    }

    private fun load(restart: Boolean, force: Boolean = false) {
        val current = mutableState.value
        if (sessionInvalidationEmitted || (current.isLoading && !(restart && force)) ||
            (!force && current.hasLoaded)
        ) return

        val startPage = if (restart) 1 else current.failedPage ?: current.nextPage
        val generation = ++requestGeneration
        loadJob?.cancel()
        mutableState.update { before ->
            before.copy(
                isLoading = true,
                nextPage = startPage,
                failedPage = null,
                replaceThreadsOnPageOne = restart,
                failure = null,
                pendingSessionInvalidation = null,
            )
        }
        loadJob = requestScope.launch {
            var page = startPage
            while (true) {
                val result = requestResult { repository.page(page) }
                if (generation != requestGeneration) return@launch
                val error = result.exceptionOrNull()
                if (error != null) {
                    if (error.isAuthenticationFailure()) {
                        emitSessionInvalidation()
                    } else {
                        mutableState.update {
                            it.copy(
                                isLoading = false,
                                hasLoaded = true,
                                failedPage = page,
                                failure = error.toUiFailure(UiFailureFallback.LOAD_MESSAGES),
                            )
                        }
                    }
                    return@launch
                }

                val batch = result.getOrThrow()
                mutableState.update { before ->
                    before.copy(
                        threads = if (page == 1 && before.replaceThreadsOnPageOne) {
                            batch.distinctBy(MessageThread::id)
                        } else {
                            (before.threads + batch).distinctBy(MessageThread::id)
                        },
                        nextPage = page + 1,
                        replaceThreadsOnPageOne = false,
                    )
                }
                if (batch.size < PAGE_SIZE) {
                    lastLoadedAt = now()
                    cache.threads = mutableState.value.threads
                    cache.loadedAt = lastLoadedAt
                    mutableState.update {
                        it.copy(isLoading = false, hasLoaded = true, failedPage = null)
                    }
                    return@launch
                }
                page++
            }
        }
    }

    // load validates the request generation immediately before calling this non-suspending helper.
    private fun emitSessionInvalidation() {
        sessionInvalidationEmitted = true
        cache.clear()
        mutableState.update {
            it.copy(
                threads = emptyList(),
                isLoading = false,
                hasLoaded = true,
                failedPage = null,
                failure = null,
                pendingSessionInvalidation = InboxSessionInvalidation(++nextInvalidationID),
            )
        }
    }


    override fun onCleared() {
        requestGeneration++
        loadJob?.cancel()
        mutableState.value = InboxUiState()
        super.onCleared()
    }

    class Factory(
        private val repository: InboxRepository,
        private val session: MemberSession,
        private val scope: CoroutineScope? = null,
        private val cache: InboxCache = InboxCache(),
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(InboxViewModel::class.java))
            return InboxViewModel(repository, session, scope, cache = cache) as T
        }
    }

    companion object {
        private const val PAGE_SIZE = 50
    }
}

internal fun ViewModelStoreOwner.inboxViewModel(
    api: MobileApiClient,
    session: MemberSession,
    cache: InboxCache = InboxCache(),
): InboxViewModel {
    val username = session.member.username
    return ViewModelProvider(
        this,
        InboxViewModel.Factory(MobileApiInboxRepository(api, session), session, cache = cache),
    )["InboxViewModel:$username", InboxViewModel::class.java].also {
        it.updateApi(api)
        it.onEvent(InboxEvent.SessionChanged(session))
    }
}
