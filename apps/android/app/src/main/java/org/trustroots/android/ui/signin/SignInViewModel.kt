package org.trustroots.android.ui.signin

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import androidx.compose.runtime.Composable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.BrowserSignInAttempt
import org.trustroots.android.api.BrowserSignInCallback
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.ui.common.rememberEntryViewModel

internal data class SignInUiState(
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: UiFailure? = null,
    val pendingSuccess: SignInSuccess? = null,
    val browserSignInRequired: Boolean = false,
)

internal data class SignInSuccess(
    val id: Long,
    val session: MemberSession,
)

internal sealed interface SignInEvent {
    data class UsernameChanged(val value: String) : SignInEvent
    data class PasswordChanged(val value: String) : SignInEvent
    data object Submit : SignInEvent
    data class SuccessDelivered(val id: Long) : SignInEvent
}

internal fun interface SignInAuthenticator {
    suspend fun signIn(username: String, password: String): Result<MemberSession>
}

internal class SignInViewModel(
    apiBaseUrl: String,
    initialMessage: UiFailure?,
    private val authenticator: SignInAuthenticator = SignInAuthenticator(MobileApiClient(apiBaseUrl)::signIn),
    scope: CoroutineScope?,
    private val sessionStore: SecureMobileSessionStore? = null,
) : ViewModel() {
    private val parentScope = scope ?: viewModelScope
    private val requestJob = SupervisorJob(parentScope.coroutineContext[Job])
    private val requestScope = CoroutineScope(parentScope.coroutineContext + requestJob)
    private val mutableState = MutableStateFlow(SignInUiState(error = initialMessage))
    val state = mutableState.asStateFlow()
    private var nextSuccessID = 0L
    private val browserApi = MobileApiClient(apiBaseUrl)

    fun onEvent(event: SignInEvent) {
        when (event) {
            is SignInEvent.UsernameChanged -> mutableState.update { it.copy(username = event.value) }
            is SignInEvent.PasswordChanged -> mutableState.update { it.copy(password = event.value) }
            SignInEvent.Submit -> submit()
            is SignInEvent.SuccessDelivered -> mutableState.update { state ->
                if (state.pendingSuccess?.id == event.id) state.copy(pendingSuccess = null) else state
            }
        }
    }

    private fun submit() {
        val current = mutableState.value
        if (
            current.isLoading || current.pendingSuccess != null ||
            current.username.isBlank() || current.password.isBlank()
        ) return

        val username = current.username.trim()
        val password = current.password
        mutableState.update { it.copy(browserSignInRequired = false) }
        authenticate { authenticator.signIn(username, password) }
    }

    fun startBrowserSignIn(openBrowser: (String) -> Boolean) {
        val store = sessionStore ?: return
        val current = mutableState.value
        if (!current.browserSignInRequired || current.isLoading || current.pendingSuccess != null) return
        val opened = runCatching {
            val attempt = BrowserSignInAttempt.create(browserApi.backendURL)
            store.saveBrowserSignIn(attempt)
            openBrowser(attempt.startURL())
        }.getOrDefault(false)
        if (!opened) {
            mutableState.update { it.copy(error = UiFailure(fallback = UiFailureFallback.BROWSER_SIGN_IN_UNAVAILABLE)) }
        }
    }

    fun completeBrowserSignIn(callback: BrowserSignInCallback) {
        val store = sessionStore ?: return
        val current = mutableState.value
        if (current.isLoading || current.pendingSuccess != null) return
        authenticate(UiFailureFallback.BROWSER_SIGN_IN_RETRY) {
            val attempt = withContext(Dispatchers.IO) {
                store.takeBrowserSignIn(browserApi.backendURL, callback.state)
            }
            if (attempt == null) {
                Result.failure(IllegalStateException("No matching pending browser sign-in"))
            } else {
                browserApi.exchangeBrowserSignInCode(callback.code, attempt.codeVerifier)
            }
        }
    }

    private fun authenticate(
        fallback: UiFailureFallback = UiFailureFallback.REACH_TRUSTROOTS,
        request: suspend () -> Result<MemberSession>,
    ) {
        mutableState.update { it.copy(isLoading = true, error = null, pendingSuccess = null) }
        requestScope.launch {
            val result = try {
                request()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                Result.failure(error)
            }
            currentCoroutineContext().ensureActive()
            result.fold(
                onSuccess = { session ->
                    val id = ++nextSuccessID
                    mutableState.update {
                        it.copy(isLoading = false, pendingSuccess = SignInSuccess(id, session))
                    }
                },
                onFailure = { error ->
                    val webSignInRequired = fallback == UiFailureFallback.REACH_TRUSTROOTS && error is MobileApiException &&
                        error.statusCode == 403 && error.code == "web_sign_in_required"
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            error = if (fallback == UiFailureFallback.BROWSER_SIGN_IN_RETRY) {
                                UiFailure(fallback = fallback)
                            } else {
                                error.toUiFailure(fallback)
                            },
                            browserSignInRequired = it.browserSignInRequired || webSignInRequired,
                            password = if (webSignInRequired) "" else it.password,
                        )
                    }
                },
            )
        }
    }

    override fun onCleared() {
        requestJob.cancel()
        mutableState.value = SignInUiState()
        super.onCleared()
    }
}

/** Activity-retained parent for the signed-out Navigation 3 destination graph. */
internal class SignInDestinationStoreHolder : ViewModel(), ViewModelStoreOwner {
    private var graphStore = ViewModelStore()
    override val viewModelStore: ViewModelStore get() = graphStore
    private val mutableGraphGeneration = MutableStateFlow(0L)
    val graphGeneration = mutableGraphGeneration.asStateFlow()
    private var backendIdentity: String? = null

    fun activateBackend(apiBaseUrl: String) {
        val identity = apiBaseUrl.trim().trimEnd('/')
        if (backendIdentity != null && backendIdentity != identity) clearDestination()
        backendIdentity = identity
    }

    fun clearDestination() {
        graphStore.clear()
        graphStore = ViewModelStore()
        mutableGraphGeneration.update { it + 1 }
    }

    override fun onCleared() {
        graphStore.clear()
        super.onCleared()
    }
}

@Composable
internal fun rememberSignInViewModel(
    apiBaseUrl: String,
    initialMessage: UiFailure?,
    sessionStore: SecureMobileSessionStore,
): SignInViewModel {
    val owner = requireNavigationViewModelStoreOwner("Sign-in screens must be hosted by their Navigation 3 entry.")
    return rememberEntryViewModel(
        owner,
        SignInViewModel::class.java,
        SignInViewModelFactory(apiBaseUrl, initialMessage, sessionStore = sessionStore),
    )
}

internal class SignInViewModelFactory(
    private val apiBaseUrl: String,
    private val initialMessage: UiFailure?,
    private val authenticator: SignInAuthenticator = SignInAuthenticator(MobileApiClient(apiBaseUrl)::signIn),
    private val scope: CoroutineScope? = null,
    private val sessionStore: SecureMobileSessionStore? = null,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(SignInViewModel::class.java))
        return SignInViewModel(apiBaseUrl, initialMessage, authenticator, scope, sessionStore) as T
    }
}
