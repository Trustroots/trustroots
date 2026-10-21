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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
import org.trustroots.android.R
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.HostingDetails
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.hostingDetailsValidationMessage
import org.trustroots.android.ui.common.MemberLargeTopAppBar
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.messageTime

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
    val sendMessageError = stringResource(R.string.screen_send_message_error)
    val loadConversationError = stringResource(R.string.screen_load_conversation_error)
    val viewProfileLabel = stringResource(R.string.screen_view_profile)
    val hostYesMessage = stringResource(R.string.screen_quick_reply_host_yes_html)
    val hostNoMessage = stringResource(R.string.screen_quick_reply_host_no_html)
    val context = LocalContext.current
    val drafts = remember { MessageDraftStore(context) }
    val draftKey = member.username ?: member.id.orEmpty()
    var messages by remember(member.id) { mutableStateOf<List<DirectMessage>>(emptyList()) }
    var draft by remember(member.id) { mutableStateOf(drafts.load(session.member.username, draftKey)) }
    var error by remember(member.id) { mutableStateOf<String?>(null) }
    var sending by remember { mutableStateOf(false) }
    var messagesLoaded by remember(member.id) { mutableStateOf(false) }
    var hostingMode by remember(member.id) { mutableStateOf(false) }
    var hostingDescription by remember(member.id) { mutableStateOf("") }
    var hostingContextLoaded by remember(member.id) { mutableStateOf(false) }
    var hostingContextLoading by remember(member.id) { mutableStateOf(false) }
    var hostingContextError by remember(member.id) { mutableStateOf(false) }
    var hostingAckRequired by remember(member.id) { mutableStateOf(false) }
    var hostingDescriptionAcknowledged by remember(member.id) { mutableStateOf(false) }
    var hostingGuests by remember(member.id) { mutableStateOf("1") }
    var hostingArrival by remember(member.id) { mutableStateOf("") }
    var hostingDeparture by remember(member.id) { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val composerFocus = remember { FocusRequester() }
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val chronologicalMessages = messages.asReversed()
    val latestOwnMessageIndex = chronologicalMessages.indexOfLast { it.sender.username == session.member.username }
    val showQuickReply = chronologicalMessages.indices.any { index ->
        index > latestOwnMessageIndex && chronologicalMessages[index].sender.username != session.member.username &&
            chronologicalMessages[index].hostingDetails != null
    }
    val hostingDetailsError = hostingDetailsValidationMessage(hostingGuests, hostingArrival, hostingDeparture)
    val composerEnabled = member.id != null && !sending && (!hostingMode ||
        hostingContextLoaded && !hostingContextLoading && !hostingContextError &&
        (!hostingAckRequired || hostingDescriptionAcknowledged) && hostingDetailsError == null)

    val loadHostingContext: () -> Unit = {
        val id = member.id
        if (id != null && !hostingContextLoading) {
            scope.launch {
                hostingContextLoading = true
                hostingContextError = false
                api.hostingContext(session, id).onSuccess {
                    hostingDescription = it.description
                    hostingAckRequired = it.acknowledgementRequired
                    hostingContextLoaded = true
                }.onFailure {
                    if (it.isAuthenticationFailure()) onSessionInvalidated()
                    else hostingContextError = true
                }
                hostingContextLoading = false
            }
        }
    }
    val updateDraft: (String) -> Unit = { text ->
        draft = text
        drafts.save(session.member.username, draftKey, text)
    }
    val sendContent: (String, Boolean, Boolean) -> Unit = sendContent@{ content, includeHostingDetails, clearDraft ->
        val id = member.id ?: return@sendContent
        val trimmed = content.trim()
        if (trimmed.isBlank() || sending) return@sendContent
        val guests = hostingGuests.toIntOrNull()
        if (includeHostingDetails && (!hostingContextLoaded || hostingContextLoading || hostingContextError ||
                hostingAckRequired && !hostingDescriptionAcknowledged || hostingDetailsError != null)) return@sendContent
        scope.launch {
            sending = true
            val details = if (includeHostingDetails) HostingDetails(
                guests = guests ?: 1,
                arrival = hostingArrival.trim().takeIf { it.isNotBlank() },
                departure = hostingDeparture.trim().takeIf { it.isNotBlank() },
            ) else null
            api.sendMessage(session, id, content, details, hostingDescriptionAcknowledged).onSuccess {
                messages = listOf(it) + messages
                if (clearDraft) {
                    draft = ""
                    drafts.clear(session.member.username, draftKey)
                }
                if (includeHostingDetails) {
                    hostingMode = false
                    hostingDescription = ""
                    hostingContextLoaded = false
                    hostingContextError = false
                    hostingAckRequired = false
                    hostingGuests = "1"
                    hostingArrival = ""
                    hostingDeparture = ""
                    hostingDescriptionAcknowledged = false
                }
                error = null
            }.onFailure { failure ->
                if (failure.isAuthenticationFailure()) onSessionInvalidated()
                else if ((failure as? org.trustroots.android.api.MobileApiException)?.code == "hosting-description-acknowledgement-required") {
                    hostingDescriptionAcknowledged = false
                    hostingContextLoaded = false
                    hostingContextError = false
                    loadHostingContext()
                    error = "Review the hosting description and acknowledge it before sending."
                } else error = failure.messageOr(sendMessageError)
            }
            sending = false
        }
    }
    val send: () -> Unit = { sendContent(draft, hostingMode, true) }
    LaunchedEffect(member.id) {
        val id = member.id ?: return@LaunchedEffect
        api.conversation(session, id).onSuccess {
            messages = it
            messagesLoaded = true
        }.onFailure {
            messagesLoaded = true
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr(loadConversationError)
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
                    if (onOpenProfile != null) TextButton(onClick = onOpenProfile) { Text(viewProfileLabel, maxLines = 1) }
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
                                message.hostingDetails?.let { details ->
                                    Text(if (details.guests == 1) "1 guest" else "${details.guests} guests")
                                    if (details.arrival != null && details.departure != null) Text("${details.arrival} – ${details.departure}")
                                }
                                message.createdAt?.let { created ->
                                    Text(
                                        messageTime(context.resources, created),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
            if (hostingMode) Column(Modifier.heightIn(max = 280.dp).verticalScroll(rememberScrollState())) {
                when {
                    hostingContextLoading || !hostingContextLoaded && !hostingContextError -> Text("Loading hosting details…")
                    hostingContextError -> Column {
                        Text("Could not load hosting details. Retry or turn off hosting mode.", color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = loadHostingContext) { Text("Retry") }
                    }
                    hostingContextLoaded -> {
                        if (hostingDescription.isNotBlank()) {
                            Text(
                                Html.fromHtml(hostingDescription, Html.FROM_HTML_MODE_COMPACT).toString().trim(),
                            )
                        }
                        hostingDetailsError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        Text("Please read the host’s description before sending your visit details.")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextField(
                                hostingGuests,
                                { hostingGuests = it.filter(Char::isDigit).take(3) },
                                label = { Text("Guests") },
                                modifier = Modifier.weight(1f).testTag("hostingGuests"),
                                singleLine = true,
                            )
                            TextField(
                                hostingArrival,
                                { hostingArrival = it },
                                label = { Text("Arrival (YYYY-MM-DD)") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                            TextField(
                                hostingDeparture,
                                { hostingDeparture = it },
                                label = { Text("Departure (YYYY-MM-DD)") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                            )
                        }
                        if (hostingAckRequired) Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = hostingDescriptionAcknowledged,
                                onCheckedChange = { hostingDescriptionAcknowledged = it },
                                modifier = Modifier.testTag("hostingDescriptionAcknowledgement"),
                            )
                            Text("I have read this host’s hosting description and requirements.")
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = hostingMode,
                    onCheckedChange = {
                        hostingMode = it
                        hostingDescriptionAcknowledged = false
                        if (it && !hostingContextLoaded) loadHostingContext()
                    },
                    modifier = Modifier.testTag("hostingModeToggle"),
                )
                Text("Add hosting details")
            }
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            if (showQuickReply) {
                QuickReplyBar(
                    onHostYes = { sendContent(hostYesMessage, false, false) },
                    onHostNo = { sendContent(hostNoMessage, false, false) },
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
                    IconButton(onClick = send, enabled = composerEnabled && draft.isNotBlank()) {
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
