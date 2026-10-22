package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.account.AccountSettingsScreen
import org.trustroots.android.ui.hostoffer.HostOfferScreen

/** Test host with the same entry-scoped ViewModel decorators as the app's Nav3 displays. */
@Composable
internal fun FormRecoveryNav3Harness(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
) {
    val backStack = rememberNavBackStack(FormRecoveryRoot)
    var nextVisit by rememberSaveable { mutableLongStateOf(1L) }
    val pop: () -> Unit = { if (backStack.size > 1) backStack.removeLastOrNull(); Unit }

    Column(Modifier.fillMaxSize()) {
        if (backStack.size > 1) {
            Row {
                Button(onClick = pop) { Text("Return to form launcher") }
            }
        }
        NavDisplay(
            modifier = Modifier.weight(1f),
            backStack = backStack,
            onBack = pop,
            entryDecorators = listOf(
                rememberSaveableStateHolderNavEntryDecorator(),
                rememberViewModelStoreNavEntryDecorator(),
            ),
            entryProvider = entryProvider {
                entry<FormRecoveryRoot> {
                    Column {
                        Button(onClick = { backStack.add(AccountRecoveryVisit(nextVisit++)) }) {
                            Text("Open account settings")
                        }
                        Button(onClick = { backStack.add(HostRecoveryVisit(nextVisit++)) }) {
                            Text("Open hosting settings")
                        }
                    }
                }
                entry<AccountRecoveryVisit> {
                    AccountSettingsScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = pop,
                        onResetPassword = {},
                        onSignedOut = {},
                    )
                }
                entry<HostRecoveryVisit> {
                    HostOfferScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = pop,
                    )
                }
            },
        )
    }
}

@Serializable
private data object FormRecoveryRoot : NavKey

@Serializable
private data class AccountRecoveryVisit(val visitID: Long) : NavKey

@Serializable
private data class HostRecoveryVisit(val visitID: Long) : NavKey
