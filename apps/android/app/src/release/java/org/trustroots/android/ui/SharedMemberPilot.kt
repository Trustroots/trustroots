package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.ui.session.AppSessionUiState
import org.trustroots.android.ui.session.AppSessionViewModel

@Suppress("UNUSED_PARAMETER")
internal fun isSharedHomeRequested(activity: ComponentActivity): Boolean = false

@Suppress("UNUSED_PARAMETER")
@Composable
internal fun showSharedMemberPilot(
    activity: ComponentActivity,
    apiBaseUrl: String,
    sessionStore: SecureMobileSessionStore,
    responseCache: SecureResponseCache,
    sessionViewModel: AppSessionViewModel,
    sessionState: AppSessionUiState,
): Boolean = false
