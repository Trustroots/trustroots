package org.trustroots.android.ui.signin

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.ui.editprofile.EditProfileScreen

@Composable
internal fun SignUpOnboarding(
    api: MobileApiClient,
    session: MemberSession,
    onComplete: (MemberProfile?) -> Unit,
    onSessionInvalidated: () -> Unit,
) {
    var editingProfile by rememberSaveable { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().safeDrawingPadding()) {
        if (editingProfile) {
            EditProfileScreen(
                api = api,
                session = session,
                username = session.member.username,
                onSessionInvalidated = onSessionInvalidated,
                onCancel = { editingProfile = false },
                onSaved = onComplete,
            )
        } else {
            BackHandler { onComplete(null) }
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(stringResource(R.string.signup_welcome), style = MaterialTheme.typography.headlineMedium)
                Text(stringResource(R.string.signup_confirm_email))
                Button(onClick = { editingProfile = true }) {
                    Text(stringResource(R.string.screen_edit_profile))
                }
                TextButton(onClick = { onComplete(null) }) { Text(stringResource(R.string.signup_continue)) }
            }
        }
    }
}
