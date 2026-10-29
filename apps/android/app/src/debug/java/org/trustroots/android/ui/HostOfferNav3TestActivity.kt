package org.trustroots.android.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.LeaveGuard
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.hostoffer.HostOfferRepository
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.hostoffer.LocalHostOfferRepository
import org.trustroots.android.ui.theme.TrustrootsTheme

/** Debug-only seam; test repository implementations stay in androidTest. */
internal object HostOfferNav3JourneyProvider {
    var repository: HostOfferRepository? = null

    fun requireRepository(): HostOfferRepository = requireNotNull(repository)
}

@Serializable
private data object HostOfferTestMenuRoute : NavKey

@Serializable
private data class HostOfferTestRoute(val visitId: Long) : NavKey

class HostOfferNav3TestActivity : ComponentActivity() {
    internal var sceneBack: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TrustrootsTheme {
                val backStack = rememberNavBackStack(HostOfferTestMenuRoute)
                val nextVisit = rememberSaveable { mutableLongStateOf(1L) }
                val leaveGuard = remember { mutableStateOf<LeaveGuard?>(null) }
                val handleBack: () -> Unit = {
                    val leave = { if (backStack.size > 1) backStack.removeLastOrNull() }
                    leaveGuard.value?.invoke(leave) ?: leave()
                }
                SideEffect { sceneBack = handleBack }
                CompositionLocalProvider(LocalLeaveGuard provides leaveGuard) {
                    NavDisplay(
                        backStack = backStack,
                        onBack = handleBack,
                        entryDecorators = listOf(
                            rememberSaveableStateHolderNavEntryDecorator(),
                            rememberViewModelStoreNavEntryDecorator(),
                        ),
                        entryProvider = entryProvider {
                            entry<HostOfferTestMenuRoute> {
                                Button(onClick = {
                                    backStack.add(HostOfferTestRoute(nextVisit.longValue++))
                                }) { Text("Open hosting form") }
                            }
                            entry<HostOfferTestRoute> {
                                CompositionLocalProvider(
                                    LocalHostOfferRepository provides HostOfferNav3JourneyProvider.requireRepository(),
                                ) {
                                    HostOfferScreen(
                                        api = MobileApiClient("https://api.example.test"),
                                        session = MemberSession("fixture-session", MobileMember("quiet-fox", "Quiet Fox")),
                                        onSessionInvalidated = {},
                                        onBack = { if (backStack.size > 1) backStack.removeLastOrNull() },
                                    )
                                }
                            }
                        },
                    )
                }
            }
        }
    }
}
