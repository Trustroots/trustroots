package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class MemberInboxThread(
    val id: String,
    val memberId: String?,
    val name: String,
    val handle: String?,
    val excerpt: String,
    val timestamp: String,
    val unread: Boolean,
)

/** The host supplies the visible threads and owns the inbox requests. */
class MemberInboxState {
    internal var content by mutableStateOf(MemberInboxContent())
        private set

    fun update(
        threads: List<MemberInboxThread>,
        filter: String,
        hasThreads: Boolean,
        isLoading: Boolean,
        isSearching: Boolean,
        error: String?,
    ) {
        content = MemberInboxContent(threads, filter, hasThreads, isLoading, isSearching, error)
    }

    internal fun editFilter(text: String) {
        content = content.copy(filter = text)
    }
}

internal data class MemberInboxContent(
    val threads: List<MemberInboxThread> = emptyList(),
    val filter: String = "",
    val hasThreads: Boolean = false,
    val isLoading: Boolean = true,
    val isSearching: Boolean = false,
    val error: String? = null,
)

@Composable
internal fun MemberInbox(
    state: MemberInboxState,
    onFilter: (String) -> Unit,
    onOpen: (String) -> Unit,
    onRetry: () -> Unit,
    avatar: @Composable (MemberInboxThread) -> Unit,
) {
    val content = state.content
    val focus = LocalFocusManager.current
    Column(Modifier.fillMaxSize().background(pilotPalette.background)) {
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { PilotTitle("Messages") }
            items(content.threads, key = { it.id }) { thread ->
                MemberInboxRow(
                    thread,
                    onOpen = {
                        focus.clearFocus()
                        onOpen(thread.id)
                    },
                    avatar = { avatar(thread) },
                )
            }
            item {
                when {
                    content.error != null -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PilotError(content.error)
                        PilotButton("Try again", onClick = onRetry)
                    }
                    content.isSearching -> PilotText("Searching message content…")
                    content.isLoading -> PilotText(
                        if (content.hasThreads) "Loading older conversations…" else "Loading messages…",
                    )
                    !content.hasThreads -> PilotText("No conversations yet.")
                    content.threads.isEmpty() -> PilotText("No matching conversations.")
                }
            }
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            PilotInput(
                label = "Filter conversations",
                value = content.filter,
                tag = "inbox-filter",
                enabled = true,
            ) { filter ->
                state.editFilter(filter)
                onFilter(filter)
            }
        }
    }
}

@Composable
private fun MemberInboxRow(
    thread: MemberInboxThread,
    onOpen: () -> Unit,
    avatar: @Composable () -> Unit,
) {
    val palette = pilotPalette
    val shape = RoundedCornerShape(20.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (thread.unread) palette.surface else palette.background)
            .border(1.dp, palette.accent, shape)
            .clickable(role = Role.Button, onClick = onOpen)
            .testTag("message-thread-${thread.id}")
            .semantics { stateDescription = if (thread.unread) "Unread" else "Read" }
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        avatar()
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            PilotText(thread.name, strong = thread.unread)
            thread.handle?.let { InboxDetail(it) }
            if (thread.unread) {
                InboxDetail("Unread", Modifier.testTag("unread-${thread.id}"))
            }
            if (thread.excerpt.isNotBlank()) {
                BasicText(
                    thread.excerpt,
                    style = TextStyle(color = palette.ink, fontSize = 14.sp, lineHeight = 18.sp),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (thread.timestamp.isNotBlank()) InboxDetail(thread.timestamp)
        }
    }
}

@Composable
private fun InboxDetail(value: String, modifier: Modifier = Modifier) {
    BasicText(value, modifier, style = TextStyle(color = pilotPalette.ink, fontSize = 12.sp))
}
