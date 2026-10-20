package org.trustroots.android.ui.contacts

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.profile.MemberProfileScreen

@Composable
internal fun ContactsScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    var contacts by remember { mutableStateOf<List<ProfileContact>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedUsername by remember { mutableStateOf<String?>(null) }
    selectedUsername?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated, onBack = { selectedUsername = null }, contentPadding = contentPadding)
        return
    }
    LaunchedEffect(session.member.username) {
        loading = true
        error = null
        api.profile(session, session.member.username).onSuccess { member ->
            val memberID = member.id
            if (memberID == null) {
                error = "Could not load contacts."
                loading = false
                return@onSuccess
            }
            api.contacts(session, memberID).onSuccess {
                contacts = it
                loading = false
            }.onFailure {
                if (it.isAuthenticationFailure()) onSessionInvalidated()
                else {
                    error = it.messageOr("Could not load contacts.")
                    loading = false
                }
            }
        }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else {
                error = it.messageOr("Could not load contacts.")
                loading = false
            }
        }
    }
    Column(
        Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding())
            .padding(20.dp),
    ) {
        NativeBackButton(onBack)
        Text("Contacts", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        when {
            loading -> CircularProgressIndicator(modifier = Modifier.padding(top = 20.dp))
            error != null -> Text(
                requireNotNull(error),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 16.dp),
            )
            contacts.isEmpty() -> Text(
                "People you connect with on Trustroots will appear here.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 16.dp),
            )
            else -> Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(top = 12.dp)) {
                contacts.forEach { contact ->
                    val username = contact.user.username
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (username != null) Modifier.clickable { selectedUsername = username }
                                else Modifier,
                            )
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RemoteArtwork(
                            url = contact.user.id?.let { api.avatarURL(it, 64) },
                            sessionCookie = session.cookieHeader,
                            label = contact.user.displayName,
                            size = 54.dp,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(contact.user.displayName, fontWeight = FontWeight.Bold)
                            username?.let { Text("@$it") }
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
