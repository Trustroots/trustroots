@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.conversation

import androidx.compose.ui.res.painterResource
import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.ime
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.localizedLabel
import org.trustroots.android.ui.common.messageTime
import org.trustroots.android.ui.common.resolveFailureMessage

@Composable
internal fun MessageConversationEntryScreen(
    memberID: String,
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onOpenProfile: ((String) -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val owner = requireNavigationViewModelStoreOwner("Conversation must be hosted by a Navigation 3 ViewModelStoreOwner.")
    val context = LocalContext.current.applicationContext
    val model = remember(owner, memberID, session.member.username) {
        owner.messageConversationViewModel(memberID, api, session, context)
    }
    val state by model.state.collectAsState()
    LaunchedEffect(model, session) { model.onEvent(MessageConversationEvent.SessionChanged(session)) }
    LaunchedEffect(model, api) { model.updateApi(api) }
    LaunchedEffect(model, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        model.onEvent(MessageConversationEvent.SessionInvalidationDelivered(pending.id))
    }
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    val composerFocus = remember { FocusRequester() }
    val messageListState = rememberLazyListState()
    LaunchedEffect(model, state.lastSentMessageID) {
        if (state.lastSentMessageID != null) messageListState.scrollToItem(0)
    }
    val yesMessage = stringResource(R.string.screen_quick_reply_host_yes_html)
    val noMessage = stringResource(R.string.screen_quick_reply_host_no_html)
    val member = state.member
    val title = member?.localizedLabel().orEmpty()
    val send: (String) -> Unit = { model.onEvent(MessageConversationEvent.Send(it)) }
    val quickReply: (String) -> Unit = { model.onEvent(MessageConversationEvent.QuickReply(it)) }
    val openProfile: (() -> Unit)? = member?.username?.let { username ->
        if (onOpenProfile == null) null else ({ onOpenProfile(username) })
    }

    val keyboardOpen = WindowInsets.ime.getBottom(LocalDensity.current) > 0

    Scaffold(
        modifier = Modifier.fillMaxSize().imePadding().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            PinnedTopAppBar(
                title = title.ifBlank { stringResource(R.string.screen_messages_title) },
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
                onBack = onBack,
                leadingContent = member?.let {
                    {
                        RemoteArtwork(
                            url = api.avatarURL(it.id, 64, session),
                            sessionCookie = session.cookieHeader,
                            accessToken = session.accessToken,
                            label = it.localizedLabel(),
                            size = 36.dp,
                        )
                    }
                },
                actions = { openProfile?.let { callback ->
                    TextButton(onClick = callback) { Text(stringResource(R.string.screen_view_profile), maxLines = 1) }
                } },
            )
        },
    ) { appBarPadding ->
        Column(
            Modifier.fillMaxSize()
                .padding(top = appBarPadding.calculateTopPadding())
                .padding(contentPadding.horizontalInset())
                .padding(horizontal = 20.dp)
                .padding(bottom = if (keyboardOpen) 8.dp else contentPadding.calculateBottomPadding() + 20.dp),
        ) {
            state.failure?.let { failure ->
                Text(resolveFailureMessage(failure), color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("conversationFailure"))
                if (state.loadFailed) {
                    OutlinedButton(
                        onClick = { model.onEvent(MessageConversationEvent.Retry) },
                        enabled = !state.isSending,
                        modifier = Modifier.testTag("conversationRetry"),
                    ) {
                        Text(stringResource(R.string.retry))
                    }
                }
            }
            if (state.isLoading && member == null) CircularProgressIndicator()
            LazyColumn(Modifier.weight(1f).testTag("conversationMessages"), state = messageListState, reverseLayout = true) {
                if (member != null) {
                    items(state.messages, key = { it.id }) { message ->
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = if (message.sender.username == state.currentUsername) Arrangement.End else Arrangement.Start,
                        ) {
                            if (message.sender.username != state.currentUsername) {
                                RemoteArtwork(
                                    url = api.avatarURL(member.id, 64, session),
                                    sessionCookie = session.cookieHeader,
                                    accessToken = session.accessToken,
                                    label = member.localizedLabel(),
                                    size = 30.dp,
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = if (message.sender.username == state.currentUsername) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.padding(start = 6.dp, top = 8.dp, bottom = 8.dp)
                                    .widthIn(max = 280.dp)
                                    .testTag(if (message.sender.username == state.currentUsername) "outgoingMessage" else "incomingMessage"),
                            ) {
                                Column(Modifier.padding(12.dp)) {
                                    Text(
                                        remember(message.content, api.backendURL) {
                                            messageContent(message.content, api.backendURL)
                                        },
                                    )
                                    message.hostingDetails?.let { details ->
                                        Text(if (details.guests == 1) "1 guest" else "${details.guests} guests")
                                        if (details.arrival != null && details.departure != null) {
                                            Text("${details.arrival} – ${details.departure}")
                                        }
                                    }
                                    message.createdAt?.let { created ->
                                        Text(messageTime(LocalContext.current.resources, created), style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (member != null && state.hostingMode) {
                Column(
                    Modifier.heightIn(max = 280.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    when {
                        state.hostingContextLoading || !state.hostingContextLoaded && !state.hostingContextError ->
                            Text("Loading hosting details…")
                        state.hostingContextError -> Column {
                            Text(
                                "Could not load hosting details. Retry or turn off hosting mode.",
                                color = MaterialTheme.colorScheme.error,
                            )
                            TextButton(
                                onClick = { model.onEvent(MessageConversationEvent.RetryHostingContext) },
                                modifier = Modifier.testTag("hostingContextRetry"),
                            ) { Text(stringResource(R.string.retry)) }
                        }
                        state.hostingContextLoaded -> {
                            if (state.hostingDescription.isNotBlank()) {
                                Text(Html.fromHtml(state.hostingDescription, Html.FROM_HTML_MODE_COMPACT).toString().trim())
                            }
                            Text("Please read the host’s description before sending your visit details.")
                            if (state.hostingAcknowledgementStale) {
                                Text(
                                    "Review the hosting description and acknowledge it before sending.",
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                            state.hostingDetailsError?.let {
                                Text(it, color = MaterialTheme.colorScheme.error)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                TextField(
                                    value = state.hostingGuests,
                                    onValueChange = { model.onEvent(MessageConversationEvent.HostingGuestsChanged(it)) },
                                    label = { Text("Guests") },
                                    modifier = Modifier.weight(1f).testTag("hostingGuests"),
                                    singleLine = true,
                                )
                                TextField(
                                    value = state.hostingArrival,
                                    onValueChange = { model.onEvent(MessageConversationEvent.HostingArrivalChanged(it)) },
                                    label = { Text("Arrival (YYYY-MM-DD)") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true,
                                )
                                TextField(
                                    value = state.hostingDeparture,
                                    onValueChange = { model.onEvent(MessageConversationEvent.HostingDepartureChanged(it)) },
                                    label = { Text("Departure (YYYY-MM-DD)") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true,
                                )
                            }
                            if (state.hostingAckRequired) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(
                                        checked = state.hostingDescriptionAcknowledged,
                                        onCheckedChange = {
                                            model.onEvent(MessageConversationEvent.HostingAcknowledgementChanged(it))
                                        },
                                        modifier = Modifier.testTag("hostingDescriptionAcknowledgement"),
                                    )
                                    Text("I have read this host’s hosting description and requirements.")
                                }
                            }
                        }
                    }
                }
            }
            if (member != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = state.hostingMode,
                        onCheckedChange = {
                            model.onEvent(MessageConversationEvent.HostingModeChanged(it))
                        },
                        modifier = Modifier.testTag("hostingModeToggle"),
                    )
                    Text("Add hosting details")
                }
            }
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            if (member != null && state.showQuickReply) {
                QuickReplyBar(
                    onHostYes = { quickReply(yesMessage) },
                    onHostNo = { quickReply(noMessage) },
                    onWriteBack = { composerFocus.requestFocus() },
                    enabled = !state.isSending,
                )
            }
            Spacer(Modifier.height(8.dp))
            TextField(
                value = state.draft,
                onValueChange = { model.onEvent(MessageConversationEvent.DraftChanged(it)) },
                label = { Text(stringResource(R.string.form_message)) },
                modifier = Modifier.fillMaxWidth().focusRequester(composerFocus).testTag("messageComposer"),
                enabled = member != null,
                minLines = 2,
                maxLines = 8,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
                trailingIcon = {
                    IconButton(
                        onClick = { send(state.draft) },
                        enabled = member != null && state.draft.isNotBlank() && !state.isSending &&
                            (!state.hostingMode || state.hostingComposerReady),
                    ) {
                        Icon(painterResource(R.drawable.ic_material_send),
                            contentDescription = stringResource(if (state.isSending) R.string.form_sending_message else R.string.form_send_message))
                    }
                },
            )
        }
    }
}
