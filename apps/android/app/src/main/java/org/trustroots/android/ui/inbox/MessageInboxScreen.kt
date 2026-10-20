package org.trustroots.android.ui.inbox

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.ui.common.LiveFilterField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.conversation.ConversationScreen
import org.trustroots.android.ui.profile.MemberProfileScreen

@Composable
internal fun MessageInboxScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    initialMemberID: String? = null,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    var threads by remember { mutableStateOf<List<MessageThread>>(emptyList()) }
    var selected by remember { mutableStateOf<MessageMember?>(null) }
    var selectedProfile by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }
    selectedProfile?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated, onBack = { selectedProfile = null }, contentPadding = contentPadding)
        return
    }
    selected?.let { member ->
        ConversationScreen(
            api, session, member, onSessionInvalidated,
            onBack = { selected = null; reload++ },
            onOpenProfile = member.username?.let { username -> { selectedProfile = username } },
            contentPadding = contentPadding,
        )
        return
    }
    LaunchedEffect(reload) {
        loading = true
        error = null
        val collected = mutableListOf<MessageThread>()
        var page = 1
        do {
            val batch = api.inbox(session, page).getOrElse {
                if (it.isAuthenticationFailure()) onSessionInvalidated()
                else if (collected.isEmpty()) error = it.messageOr("Could not load messages.")
                break
            }
            collected += batch
            threads = collected.distinctBy { it.id }
            if (initialMemberID != null && selected == null) {
                selected = threads.firstOrNull { it.otherMember.id == initialMemberID }?.otherMember
            }
            page++
        } while (batch.size == 50)
        loaded = true
        loading = false
    }
    Column(
        Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding())
            .padding(20.dp),
    ) {
        Column (Modifier.padding(contentPadding.horizontalInset())) {
            Text("Messages", style = MaterialTheme.typography.headlineMedium)
            LiveFilterField(
                value = filter,
                onValueChange = { filter = it },
                label = stringResource(R.string.filter_conversations),
                clearLabel = stringResource(R.string.clear_conversation_filter),
            )
            if (loading) CircularProgressIndicator()
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (loaded && threads.isEmpty() && error == null) Text("No conversations yet.")
        }
        LazyColumn(Modifier.fillMaxWidth()) {
            val filteredThreads = threads.filter {
                val text = "${it.otherMember.label} ${it.otherMember.username.orEmpty()} ${it.excerpt}"
                text.contains(filter.trim(), ignoreCase = true)
            }
            items(filteredThreads, key = { it.id }) { thread ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(vertical = 8.dp).padding(contentPadding.horizontalInset())) {
                    Column(Modifier.weight(1f).clickable { selected = thread.otherMember }) {
                        Row {
                            RemoteArtwork(
                                url = thread.otherMember.id?.let { api.avatarURL(it, 64) },
                                sessionCookie = session.cookieHeader,
                                label = thread.otherMember.label,
                                size = 44.dp,
                            )
                            Column(Modifier.padding(start = 10.dp)) {
                                Text(thread.otherMember.label, fontWeight = if (thread.read) FontWeight.Normal else FontWeight.Bold)
                                Text(thread.excerpt, maxLines = 2)
                            }
                        }
                    }
                    thread.otherMember.username?.let { username ->
                        TextButton(onClick = { selectedProfile = username }) { Text("Profile") }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}
