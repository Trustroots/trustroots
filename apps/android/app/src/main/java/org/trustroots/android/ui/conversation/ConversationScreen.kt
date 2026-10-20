@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.conversation

import android.text.Html
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.MemberLargeTopAppBar
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.messageTime
import org.trustroots.android.ui.common.horizontalInset

@Composable
internal fun ConversationScreen(
    api: MobileApiClient,
    session: MemberSession,
    member: MessageMember,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onOpenProfile: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    BackHandler(onBack = onBack)
    val context = LocalContext.current
    val drafts = remember { MessageDraftStore(context) }
    val draftKey = member.username ?: member.id.orEmpty()
    var messages by remember(member.id) { mutableStateOf<List<DirectMessage>>(emptyList()) }
    var draft by remember(member.id) {
        mutableStateOf(drafts.load(session.member.username, draftKey))
    }
    var error by remember(member.id) { mutableStateOf<String?>(null) }
    var sending by remember { mutableStateOf(false) }
    var messagesLoaded by remember(member.id) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val composerFocus = remember { FocusRequester() }
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val userHasReplied = messages.any { it.sender.username == session.member.username }
    val showQuickReply = messagesLoaded && messages.isNotEmpty() && !userHasReplied
    val updateDraft: (String) -> Unit = { text ->
        draft = text
        drafts.save(session.member.username, draftKey, text)
    }
    val sendContent: (String) -> Unit = sendContent@{ content ->
        val id = member.id ?: return@sendContent
        val trimmed = content.trim()
        if (trimmed.isBlank() || sending) return@sendContent
        scope.launch {
            sending = true
            api.sendMessage(session, id, content).onSuccess {
                messages = listOf(it) + messages
                draft = ""
                drafts.clear(session.member.username, draftKey)
                error = null
            }.onFailure {
                if (it.isAuthenticationFailure()) onSessionInvalidated()
                else error = it.messageOr("Could not send message.")
            }
            sending = false
        }
    }
    val send: () -> Unit = { sendContent(draft) }
    LaunchedEffect(member.id) {
        val id = member.id ?: return@LaunchedEffect
        api.conversation(session, id).onSuccess {
            messages = it
            messagesLoaded = true
        }.onFailure {
            messagesLoaded = true
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr("Could not load conversation.")
        }
    }
    Scaffold(
        modifier = Modifier.fillMaxSize().imePadding().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            MemberLargeTopAppBar(
                title = member.label,
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
                onBack = onBack,
                leadingContent = {
                    RemoteArtwork(
                        url = member.id?.let { api.avatarURL(it, 64) },
                        sessionCookie = session.cookieHeader,
                        label = member.label,
                        size = 36.dp,
                    )
                },
                actions = {
                    if (onOpenProfile != null) {
                        TextButton(onClick = onOpenProfile) {
                            Text(stringResource(R.string.view_profile), maxLines = 1)
                        }
                    }
                },
            )
        },
    ) { appBarPadding ->
        Column(
            Modifier.fillMaxSize()
                .padding(top = appBarPadding.calculateTopPadding())
                .padding(contentPadding.horizontalInset())
                .padding(horizontal = 20.dp)
                .padding(bottom = contentPadding.calculateBottomPadding() + 20.dp),
        ) {
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                messages.asReversed().forEach { message ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.sender.username == session.member.username) Arrangement.End else Arrangement.Start) {
                        if (message.sender.username != session.member.username) {
                            RemoteArtwork(
                                url = member.id?.let { api.avatarURL(it, 64) },
                                sessionCookie = session.cookieHeader,
                                label = member.label,
                                size = 30.dp,
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (message.sender.username == session.member.username) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.padding(start = 6.dp, top = 8.dp, bottom = 8.dp).widthIn(max = 280.dp).testTag(if (message.sender.username == session.member.username) "outgoingMessage" else "incomingMessage"),
                        ) {
                            Column(Modifier.padding(12.dp)) {
                                Text(Html.fromHtml(message.content, Html.FROM_HTML_MODE_COMPACT).toString().trim())
                                message.createdAt?.let { created ->
                                    Text(
                                        messageTime(created),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            if (showQuickReply) {
                QuickReplyBar(
                    onHostYes = {
                        sendContent(
                            """<p data-hosting="yes"><b><i>Yes, I can host!</i></b></p>""",
                        )
                    },
                    onHostNo = {
                        sendContent(
                            """<p data-hosting="no"><b><i>Sorry I can't host</i></b></p>""",
                        )
                    },
                    onWriteBack = { composerFocus.requestFocus() },
                    enabled = !sending && member.id != null,
                )
            }
            Spacer(Modifier.height(8.dp))
            TextField(
                draft,
                updateDraft,
                label = { Text(stringResource(R.string.form_message)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(composerFocus)
                    .testTag("messageComposer"),
                minLines = 2,
                maxLines = 8,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
                trailingIcon = {
                    IconButton(onClick = send, enabled = member.id != null && draft.isNotBlank() && !sending) {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = stringResource(
                                if (sending) R.string.form_sending_message else R.string.form_send_message,
                            ),
                        )
                    }
                },
            )
        }
    }
}
