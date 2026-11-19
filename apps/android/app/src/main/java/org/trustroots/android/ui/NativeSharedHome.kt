package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.shared.ui.MemberDashboard

@Composable
internal fun NativeSharedHome(
    api: MobileApiClient,
    session: MemberSession,
    contentPadding: PaddingValues,
    onSessionInvalidated: () -> Unit,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit,
) {
    var openUsername by rememberSaveable(session.member.username) { mutableStateOf<String?>(null) }
    val profile = openUsername
    if (profile != null) {
        key(profile) {
            MemberProfileScreen(
                api = api,
                session = session,
                username = profile,
                onSessionInvalidated = onSessionInvalidated,
                contentPadding = contentPadding,
                onBack = { openUsername = null },
                browserContent = browserContent,
            )
        }
    } else {
        Column(Modifier.fillMaxSize().padding(contentPadding).padding(horizontal = 16.dp)) {
            Text(
                stringResource(R.string.screen_destination_home),
                Modifier.padding(vertical = 8.dp).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
            MemberDashboard(
                accountKey = api,
                loadNotes = { api.featuredNotes() },
                loadConnections = {
                    api.dashboardConnections(session).onFailure { error ->
                        if (error is MobileApiException && error.isAuthenticationFailure) onSessionInvalidated()
                    }
                },
                renderConnectionsMap = { SharedHomeConnectionsMap(it) },
                onConnection = { openUsername = it },
                showTitle = false,
            )
        }
    }
}
