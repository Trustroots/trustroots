package org.trustroots.android.ui

import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.ui.session.AppSessionUiState
import org.trustroots.android.ui.session.AppSessionViewModel
import org.trustroots.shared.ui.SharedComposeRoot

internal const val SHARED_MEMBER_PILOT_EXTRA = "org.trustroots.android.debug.SHARED_MEMBER_PILOT"

@Composable
internal fun showSharedMemberPilot(
    activity: ComponentActivity,
    apiBaseUrl: String,
    sessionStore: SecureMobileSessionStore,
    responseCache: SecureResponseCache,
    sessionViewModel: AppSessionViewModel,
    sessionState: AppSessionUiState,
): Boolean {
    var enabled by remember { mutableStateOf(activity.intent.getBooleanExtra(SHARED_MEMBER_PILOT_EXTRA, false)) }
    if (!enabled) return false

    val scope = rememberCoroutineScope()
    val gateway = remember(activity, apiBaseUrl, sessionStore, responseCache, sessionViewModel) {
        SharedMemberPilotGateway(
            context = activity.applicationContext,
            apiBaseUrl = apiBaseUrl,
            responseCache = responseCache,
            sessionStore = sessionStore,
            sessionViewModel = sessionViewModel,
            scope = scope,
            exitPilot = {
                enabled = false
                activity.intent = Intent(activity.intent).putExtra(SHARED_MEMBER_PILOT_EXTRA, false)
            },
        )
    }
    SideEffect { gateway.updateSession(sessionState.session) }
    SharedComposeRoot(
        gateway = gateway,
        username = sessionState.session?.member?.username,
        initialError = sessionState.signedOutMessage?.let { stringResource(R.string.screen_sign_in_session_expired) },
        installBackHandler = { active, onBack -> BackHandler(active, onBack) },
        renderConnectionsMap = { SharedHomeConnectionsMap(it) },
    )
    return true
}
