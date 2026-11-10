package org.trustroots.android.ui.signin

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.SignUpDetails

internal class SignUpViewModel : ViewModel() {
    var firstName by mutableStateOf("")
    var lastName by mutableStateOf("")
    var username by mutableStateOf("")
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var ageConfirmed by mutableStateOf(false)
    var newsletter by mutableStateOf(false)
    var acquisitionStory by mutableStateOf("")
    var isBusy by mutableStateOf(false)
        private set
    var accountCreated by mutableStateOf(false)
        private set
    var session by mutableStateOf<MemberSession?>(null)
        private set
    var serverError by mutableStateOf<String?>(null)
        private set
    var error by mutableStateOf<Int?>(null)
        private set

    val canSubmit: Boolean
        get() = !isBusy && session == null && (accountCreated ||
            (firstName.isNotBlank() && username.isNotBlank() && email.isNotBlank() &&
                password.length in 8..1024 && ageConfirmed))

    fun submit(api: MobileApiClient, locale: String) {
        if (!canSubmit) return
        isBusy = true
        error = null
        serverError = null
        viewModelScope.launch {
            try {
                if (!accountCreated) {
                    val signup = api.signUp(
                        SignUpDetails(
                            firstName.trim(), lastName.trim(), username.trim(), email.trim(),
                            password, ageConfirmed, newsletter, acquisitionStory.trim(), locale,
                        ),
                    )
                    ensureActive()
                    val failure = signup.exceptionOrNull()
                    if (failure != null) {
                        serverError = (failure as? MobileApiException)?.takeIf {
                            it.statusCode == 400 || it.statusCode == 429
                        }?.serverMessage
                        error = R.string.signup_failed
                        return@launch
                    }
                    accountCreated = true
                }
                val signIn = api.signIn(username.trim(), password)
                ensureActive()
                signIn.fold(
                    onSuccess = {
                        password = ""
                        session = it
                    },
                    onFailure = { error = R.string.signup_signin_failed },
                )
            } finally {
                isBusy = false
            }
        }
    }
}
