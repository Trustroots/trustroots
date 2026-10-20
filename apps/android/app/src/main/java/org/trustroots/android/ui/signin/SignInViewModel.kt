package org.trustroots.android.ui.signin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.messageOr

internal data class SignInUiState(
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val pendingSuccess: SignInSuccess? = null,
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
    initialMessage: String?,
    private val authenticator: SignInAuthenticator = SignInAuthenticator(MobileApiClient(apiBaseUrl)::signIn),
    scope: CoroutineScope? = null,
) : ViewModel() {
    private val scope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(SignInUiState(error = initialMessage))
    val state = mutableState.asStateFlow()
    private var nextSuccessID = 0L

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
        mutableState.update { it.copy(isLoading = true, error = null, pendingSuccess = null) }
        scope.launch {
            val result = try {
                authenticator.signIn(username, password)
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
                    mutableState.update {
                        it.copy(isLoading = false, error = error.messageOr("Could not reach Trustroots."))
                    }
                },
            )
        }
    }

    override fun onCleared() {
        mutableState.value = SignInUiState()
        super.onCleared()
    }
}

/** Activity-retained owner whose child store exists only for one sign-in destination. */
internal class SignInDestinationStoreHolder : ViewModel(), ViewModelStoreOwner {
    private var destinationStore = ViewModelStore()
    override val viewModelStore: ViewModelStore get() = destinationStore

    fun getViewModel(apiBaseUrl: String, initialMessage: String?): SignInViewModel =
        ViewModelProvider(this, SignInViewModelFactory(apiBaseUrl, initialMessage))
            .get(SignInViewModel::class.java)

    fun clearDestination() {
        destinationStore.clear()
        destinationStore = ViewModelStore()
    }

    override fun onCleared() {
        destinationStore.clear()
        super.onCleared()
    }
}

private class SignInViewModelFactory(
    private val apiBaseUrl: String,
    private val initialMessage: String?,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(SignInViewModel::class.java))
        return SignInViewModel(apiBaseUrl, initialMessage) as T
    }
}
