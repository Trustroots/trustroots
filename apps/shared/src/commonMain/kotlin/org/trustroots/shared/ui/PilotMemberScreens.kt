package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun Profile(
    gateway: PilotGateway,
    username: String,
    isOwnProfile: Boolean,
    onConversation: (PilotPerson, String) -> Unit,
    busy: Boolean,
    beginAction: () -> Boolean,
    endAction: () -> Unit,
) {
    var result by remember { mutableStateOf<Result<PilotProfile>?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var signOutError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(username, attempt) {
        result = awaitData { gateway.profile(username, it) }
    }

    PilotForm {
        PilotTitle("Profile")
        val loaded = result
        when {
            loaded == null -> PilotText("Loading profile…")
            loaded.isFailure -> PilotRetry(loaded, "Could not load the profile.") {
                result = null
                attempt++
            }
            else -> {
                val profile = loaded.getOrThrow()
                PilotTitle(profile.person.name)
                PilotText("@$username")
                profile.tagline?.let { PilotText(it, strong = true) }
                profile.location?.let { PilotText(it) }
                profile.about?.let { PilotText(it) }
                if (!isOwnProfile) profile.person.id?.let { memberId ->
                    PilotButton("Send a message", primary = true) { onConversation(profile.person, memberId) }
                }
            }
        }

        if (isOwnProfile) {
            signOutError?.let { PilotError(it) }
            PilotButton("Sign out", enabled = !busy) {
                if (!beginAction()) return@PilotButton
                signOutError = null
                scope.launch {
                    signOutError = awaitAction(gateway::signOut)
                    endAction()
                }
            }
        }
    }
}

private const val INBOX_PAGE_SIZE = 50

@Composable
internal fun Inbox(
    gateway: PilotGateway,
    onProfile: (String) -> Unit,
    onConversation: (PilotPerson, String) -> Unit,
) {
    var threads by remember { mutableStateOf(emptyList<PilotThread>()) }
    var page by remember { mutableIntStateOf(1) }
    var attempt by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var hasNextPage by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(page, attempt) {
        awaitData { gateway.inbox(page, it) }.fold(
            onSuccess = { loaded ->
                threads = (threads + loaded).distinctBy { it.id }
                hasNextPage = loaded.size == INBOX_PAGE_SIZE
            },
            onFailure = { error = it.message ?: "Could not load messages." },
        )
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { PilotTitle("Messages") }
        items(threads, key = { it.id }) { thread ->
            Column(
                modifier = Modifier.fillMaxWidth()
                    .background(pilotPalette.surface, RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PilotText(thread.partner.name, strong = true)
                if (thread.excerpt.isNotBlank()) PilotText(thread.excerpt)
                thread.partner.id?.let { id ->
                    PilotButton("Open conversation") { onConversation(thread.partner, id) }
                }
                thread.partner.username?.let { username ->
                    PilotButton("View profile") { onProfile(username) }
                }
            }
        }
        item {
            when {
                loading -> PilotText("Loading messages…")
                error != null -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PilotError(requireNotNull(error))
                    PilotButton("Try again") {
                        loading = true
                        error = null
                        attempt++
                    }
                }
                hasNextPage -> PilotButton("Load more messages") {
                    loading = true
                    page++
                }
                threads.isEmpty() -> PilotText("No conversations yet.")
            }
        }
    }
}

@Composable
internal fun Conversation(
    gateway: PilotGateway,
    partner: PilotPerson,
    memberId: String,
    busy: Boolean,
    beginAction: () -> Boolean,
    endAction: () -> Unit,
) {
    var result by remember { mutableStateOf<Result<List<PilotMessage>>?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var draft by remember { mutableStateOf(gateway.loadDraft(partner)) }
    var sendError by remember { mutableStateOf<String?>(null) }
    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current

    LaunchedEffect(memberId, attempt) {
        result = awaitData { gateway.conversation(memberId, it) }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PilotTitle(partner.name)
        val loaded = result
        Box(Modifier.fillMaxWidth().weight(1f)) {
            when {
                loaded == null -> PilotText("Loading conversation…")
                loaded.isFailure -> PilotRetry(loaded, "Could not load the conversation.") {
                    result = null
                    attempt++
                }
                else -> {
                    val messages = loaded.getOrThrow()
                    if (messages.isEmpty()) PilotText("No messages yet.")
                    ConversationHistory(messages, list)
                }
            }
        }
        if (loaded?.isSuccess == true) {
            PilotInput(
                label = "Write a message",
                value = draft,
                tag = "pilot-draft",
                enabled = !busy,
                singleLine = false,
            ) {
                draft = it
                gateway.saveDraft(partner, it)
            }
            sendError?.let { PilotError(it) }
            PilotButton("Send reply", primary = true, enabled = !busy && draft.isNotBlank()) {
                val content = draft.trim()
                if (!beginAction()) return@PilotButton
                sendError = null
                focus.clearFocus()
                scope.launch {
                    val sent = awaitData<PilotMessage> { gateway.send(memberId, content, it) }
                    // Scrolling can synchronously remeasure the conversation on Android.
                    withContext(Dispatchers.Main.immediate) {
                        sent.fold(
                            onSuccess = { message ->
                                result = Result.success(listOf(message) + loaded.getOrThrow().filterNot { it.id == message.id })
                                draft = ""
                                gateway.saveDraft(partner, "")
                            },
                            onFailure = { sendError = it.message ?: "Could not send your reply." },
                        )
                        endAction()
                        if (sent.isSuccess) list.scrollToItem(0)
                    }
                }
            }
        }
    }
}

@Composable
internal fun ConversationHistory(
    messages: List<PilotMessage>,
    listState: LazyListState,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().testTag("conversation-history"),
        reverseLayout = true,
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(messages, key = { it.id }) { message ->
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = if (message.outgoing) Alignment.End else Alignment.Start,
            ) {
                Column(
                    modifier = Modifier
                        .background(pilotPalette.surface, RoundedCornerShape(12.dp))
                        .padding(12.dp),
                ) {
                    PilotText(if (message.outgoing) "You" else message.author, strong = true)
                    PilotText(message.content)
                }
            }
        }
    }
}

@Composable
private fun PilotRetry(result: Result<*>, fallback: String, retry: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PilotError(result.exceptionOrNull()?.message ?: fallback)
        PilotButton("Try again", onClick = retry)
    }
}
