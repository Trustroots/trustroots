package org.trustroots.android.ui.signin

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable
import org.trustroots.android.R
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.MemberSession
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.ui.common.UsageScreenTracking

@Serializable
internal data class SignInVisit(val visitID: Long) : NavKey

@Serializable
internal data class SignInBrowserVisit(
    val purpose: SignInBrowserPurpose,
    val visitID: Long,
) : NavKey

@Serializable
internal enum class SignInBrowserPurpose { SignUp, ForgotPassword }

@Composable
internal fun SignInNavigation(
    analytics: UsageAnalytics,
    storeHolder: SignInDestinationStoreHolder,
    apiBaseUrl: String,
    initialMessage: org.trustroots.android.ui.common.UiFailure?,
    onSignedIn: (MemberSession) -> Unit,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit,
) {
    val backStack = rememberNavBackStack(SignInVisit(visitID = 0L))
    var nextVisitID by rememberSaveable { mutableLongStateOf(1L) }
    val pushBrowser: (SignInBrowserPurpose) -> Unit = { purpose ->
        backStack.add(SignInBrowserVisit(purpose, nextVisitID++))
    }
    val popRoute: () -> Unit = {
        if (backStack.size > 1) backStack.removeLastOrNull()
    }
    UsageScreenTracking(
        analytics,
        if (backStack.lastOrNull() is SignInVisit) UsageScreen.SignIn else null,
    )

    CompositionLocalProvider(LocalViewModelStoreOwner provides storeHolder) {
        // The ViewModel decorator reads the current graph owner when it is
        // remembered. Keep it inside this provider so destination stores are
        // children of the account/backend-scoped holder and are cleared with it.
        val decorators: List<NavEntryDecorator<NavKey>> = listOf(
            rememberSaveableStateHolderNavEntryDecorator(),
            rememberViewModelStoreNavEntryDecorator(),
        )
        NavDisplay(
            backStack = backStack,
            onBack = popRoute,
            entryDecorators = decorators,
            entryProvider = entryProvider {
                entry<SignInVisit> {
                    val viewModel = rememberSignInViewModel(apiBaseUrl, initialMessage)
                    SignInScreen(
                        analytics = analytics,
                        viewModel = viewModel,
                        onSignedIn = onSignedIn,
                        onSignUp = { pushBrowser(SignInBrowserPurpose.SignUp) },
                        onForgotPassword = { pushBrowser(SignInBrowserPurpose.ForgotPassword) },
                    )
                }
                entry<SignInBrowserVisit> { visit ->
                    val route = signInBrowserRoute(
                        visit.purpose,
                        stringResource(
                            if (visit.purpose == SignInBrowserPurpose.SignUp) R.string.screen_join_trustroots
                            else R.string.screen_reset_password,
                        ),
                    )
                    browserContent(route, popRoute, PaddingValues.Zero)
                }
            },
        )
    }
}

internal fun signInBrowserRoute(purpose: SignInBrowserPurpose, title: String): BrowserRoute =
    when (purpose) {
        SignInBrowserPurpose.SignUp -> BrowserRoute(title, "https://www.trustroots.org/signup")
        SignInBrowserPurpose.ForgotPassword -> BrowserRoute(title, "https://www.trustroots.org/password/forgot")
    }
