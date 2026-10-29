package org.trustroots.android.ui.session

import android.os.SystemClock
import androidx.annotation.MainThread
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.ui.MemberShellViewModelStoreOwner
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.signin.SignInDestinationStoreHolder

internal data class AppSessionUiState(
    val isStarting: Boolean = true,
    val session: MemberSession? = null,
    val signedOutMessage: UiFailure? = null,
) {
    val startupFirstName: String?
        get() = session?.let { it.member.displayName.substringBefore(' ') }

    override fun toString(): String =
        "AppSessionUiState(isStarting=$isStarting, sessionUsername=${session?.let { it.member.username }}, signedOutMessage=$signedOutMessage)"
}

internal sealed interface AppSessionEvent {
    data class BackendChanged(val backendURL: String) : AppSessionEvent
    data class SignedIn(val session: MemberSession, val backendURL: String) : AppSessionEvent {
        override fun toString(): String =
            "SignedIn(username=${session.member.username}, backendURL=$backendURL, session=[redacted])"
    }
    data class MemberUpdated(val source: AppSessionSource, val member: MobileMember) : AppSessionEvent
    data class SignedOut(val source: AppSessionSource) : AppSessionEvent
    data class SessionInvalidated(val source: AppSessionSource) : AppSessionEvent
}

/** Transient callback identity. Cookie data is deliberately redacted from its string form. */
internal data class AppSessionSource(
    val username: String,
    val cookieHeader: String,
    val backendURL: String,
) {
    override fun toString(): String = "AppSessionSource(username=$username, backendURL=$backendURL, cookieHeader=[redacted])"

    companion object {
        fun from(session: MemberSession, backendURL: String) = AppSessionSource(
            username = session.member.username,
            cookieHeader = session.cookieHeader,
            backendURL = normaliseBackendURL(backendURL),
        )
    }
}

/** Synchronous persistence methods retain the existing main-thread transition order. */
internal interface AppSessionOperations {
    suspend fun loadSession(): MemberSession?
    @MainThread fun saveSession(session: MemberSession)
    @MainThread fun clearSession()
    @MainThread fun clearResponseCache(backendURL: String, username: String)
    @MainThread fun clearSignInDestination()
    @MainThread fun clearShellAccount()
}

internal class AndroidAppSessionOperations(
    private val sessionStore: SecureMobileSessionStore,
    private val responseCache: SecureResponseCache,
    private val signInStoreHolder: SignInDestinationStoreHolder,
    private val shellGraphStore: MemberShellViewModelStoreOwner,
) : AppSessionOperations {
    override suspend fun loadSession(): MemberSession? = sessionStore.load()
    override fun saveSession(session: MemberSession) = sessionStore.save(session)
    override fun clearSession() = sessionStore.clear()
    override fun clearResponseCache(backendURL: String, username: String) =
        responseCache.clear(backendURL, username)
    override fun clearSignInDestination() = signInStoreHolder.clearDestination()
    override fun clearShellAccount() = shellGraphStore.clearAccount()
}

internal class AppSessionViewModel(
    private val operations: AppSessionOperations,
    initialBackendURL: String = "",
    scope: CoroutineScope?,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val elapsedRealtime: () -> Long = SystemClock::elapsedRealtime,
    private val wait: suspend (Long) -> Unit = { delay(it) },
) : ViewModel() {
    private val requestScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(AppSessionUiState())
    val state = mutableState.asStateFlow()

    private var restoreJob: Job? = null
    private var activeBackendURL = normaliseBackendURL(initialBackendURL)
    private var isCleared = false

    init {
        restore()
    }

    @MainThread
    fun onEvent(event: AppSessionEvent) {
        if (isCleared) return
        when (event) {
            is AppSessionEvent.BackendChanged -> activeBackendURL = normaliseBackendURL(event.backendURL)
            is AppSessionEvent.SignedIn -> {
                if (normaliseBackendURL(event.backendURL) == activeBackendURL) signedIn(event.session)
            }
            is AppSessionEvent.MemberUpdated -> {
                currentSessionForSource(event.source)?.let { current -> memberUpdated(current, event.member) }
            }
            is AppSessionEvent.SignedOut -> {
                if (currentSessionForSource(event.source) != null) signedOut(expired = false)
            }
            is AppSessionEvent.SessionInvalidated -> {
                if (currentSessionForSource(event.source) != null) signedOut(expired = true)
            }
        }
    }

    @MainThread
    private fun restore() {
        // Restoration runs once. Cancelling its job owns both asynchronous boundaries.
        restoreJob = requestScope.launch {
            val startedAt = elapsedRealtime()
            val restored = withContext(ioDispatcher) { operations.loadSession() }
            currentCoroutineContext().ensureActive()
            mutableState.value = mutableState.value.copy(session = restored)
            val remaining = STARTUP_MINIMUM_MS - (elapsedRealtime() - startedAt)
            if (remaining > 0) wait(remaining)
            currentCoroutineContext().ensureActive()
            mutableState.value = mutableState.value.copy(isStarting = false)
        }
    }

    @MainThread
    private fun signedIn(session: MemberSession) {
        cancelRestore()
        operations.saveSession(session)
        mutableState.value = AppSessionUiState(isStarting = false, session = session)
        operations.clearSignInDestination()
    }

    @MainThread
    private fun memberUpdated(current: MemberSession, member: MobileMember) {
        val updated = current.copy(member = member)
        operations.saveSession(updated)
        mutableState.value = mutableState.value.copy(session = updated)
    }

    @MainThread
    private fun signedOut(expired: Boolean) {
        cancelRestore()
        val session = mutableState.value.session
        if (session != null) {
            operations.clearResponseCache(activeBackendURL, session.member.username)
        }
        operations.clearSession()
        operations.clearSignInDestination()
        operations.clearShellAccount()
        mutableState.value = AppSessionUiState(
            isStarting = false,
            signedOutMessage = if (expired) UiFailure(fallback = UiFailureFallback.SESSION_EXPIRED) else null,
        )
    }

    @MainThread
    private fun cancelRestore() {
        restoreJob?.cancel()
        restoreJob = null
    }

    private fun currentSessionForSource(source: AppSessionSource): MemberSession? {
        val current = mutableState.value.session ?: return null
        return current.takeIf {
            source.username == current.member.username &&
                source.cookieHeader == current.cookieHeader &&
                source.backendURL == activeBackendURL
        }
    }

    @MainThread
    override fun onCleared() {
        isCleared = true
        cancelRestore()
        mutableState.value = AppSessionUiState(isStarting = false)
        super.onCleared()
    }

    class Factory(
        private val operations: AppSessionOperations,
        private val initialBackendURL: String = "",
        private val scope: CoroutineScope? = null,
        private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
        private val elapsedRealtime: () -> Long = SystemClock::elapsedRealtime,
        private val wait: suspend (Long) -> Unit = { delay(it) },
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AppSessionViewModel::class.java))
            return AppSessionViewModel(
                operations = operations,
                initialBackendURL = initialBackendURL,
                scope = scope,
                ioDispatcher = ioDispatcher,
                elapsedRealtime = elapsedRealtime,
                wait = wait,
            ) as T
        }
    }

    private companion object {
        const val STARTUP_MINIMUM_MS = 700L
    }
}

internal fun normaliseBackendURL(value: String): String = value.trim().trimEnd('/')
