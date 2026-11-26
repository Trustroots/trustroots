package org.trustroots.shared.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp

class MemberConversationState {
    internal var content by mutableStateOf(MemberConversationContent())
        private set

    fun update(
        messages: List<PilotMessage>,
        draft: String,
        isLoading: Boolean,
        isSending: Boolean,
        canSubmitDraft: Boolean,
        loadError: String?,
        sendError: String?,
        experience: String?,
        canShareExperience: Boolean,
    ) {
        content = MemberConversationContent(
            messages, draft, isLoading, isSending, canSubmitDraft, loadError, sendError, experience, canShareExperience,
        )
    }

    internal fun editDraft(draft: String) {
        content = content.copy(draft = draft)
    }
}

internal data class MemberConversationContent(
    val messages: List<PilotMessage> = emptyList(),
    val draft: String = "",
    val isLoading: Boolean = true,
    val isSending: Boolean = false,
    val canSubmitDraft: Boolean = true,
    val loadError: String? = null,
    val sendError: String? = null,
    val experience: String? = null,
    val canShareExperience: Boolean = false,
)

@Composable
internal fun MemberConversation(
    state: MemberConversationState,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    onRetry: () -> Unit,
    onShareExperience: () -> Unit,
) {
    val content = state.content
    val list = rememberLazyListState()
    var focusScrollRequest by remember { mutableIntStateOf(0) }
    val canSend = content.canSubmitDraft && !content.isLoading && !content.isSending && content.draft.isNotBlank()
    LaunchedEffect(content.messages.firstOrNull()?.id, focusScrollRequest) {
        if (content.messages.isNotEmpty()) list.scrollToItem(0)
    }

    Column(Modifier.fillMaxSize().background(pilotPalette.background)) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (content.messages.isNotEmpty()) {
                LazyColumn(
                    state = list,
                    modifier = Modifier.fillMaxSize().testTag("conversation-history"),
                    reverseLayout = true,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(content.messages, key = { it.id }) { ConversationBubble(it) }
                }
            } else {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    val error = content.loadError
                    when {
                        content.isLoading -> PilotText("Loading conversation…")
                        error != null -> {
                            PilotError(error)
                            PilotButton("Try again", onClick = onRetry)
                        }
                        else -> PilotText("No messages yet.")
                    }
                }
            }
        }
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            content.experience?.let {
                if (content.canShareExperience) {
                    PilotButton(it, onClick = onShareExperience)
                } else {
                    PilotText(it, colour = pilotPalette.accent)
                }
            }
            content.sendError?.let { PilotError(it) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                Box(Modifier.weight(1f)) {
                    PilotInput(
                        label = "Write a message",
                        value = content.draft,
                        tag = "conversation-draft",
                        enabled = !content.isSending,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                        singleLine = false,
                        maxLines = 8,
                        modifier = Modifier.onFocusChanged { if (it.isFocused) focusScrollRequest++ },
                    ) {
                        state.editDraft(it)
                        onDraft(it)
                    }
                }
                SendMessageButton(enabled = canSend, isSending = content.isSending, onSend = onSend)
            }
        }
    }
}

@Composable
private fun SendMessageButton(enabled: Boolean, isSending: Boolean, onSend: () -> Unit) {
    val palette = pilotPalette
    Box(
        modifier = Modifier.size(48.dp).clip(CircleShape)
            .background(palette.accent.copy(alpha = if (enabled) 1f else 0.5f))
            .clickable(enabled = enabled, role = Role.Button, onClick = onSend)
            .testTag("conversation-send")
            .semantics {
                contentDescription = "Send message"
                if (isSending) stateDescription = "Sending"
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(24.dp)) {
            val unit = size.width / 24f
            drawPath(
                path = Path().apply {
                    moveTo(5 * unit, 11 * unit)
                    lineTo(12 * unit, 4 * unit)
                    lineTo(19 * unit, 11 * unit)
                    moveTo(12 * unit, 4 * unit)
                    lineTo(12 * unit, 20 * unit)
                },
                color = palette.onAccent,
                style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
        }
    }
}

@Composable
internal fun ConversationBubble(message: PilotMessage) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (message.outgoing) Alignment.End else Alignment.Start,
    ) {
        Column(
            modifier = Modifier
                .background(
                    if (message.outgoing) pilotPalette.accent.copy(alpha = 0.12f) else pilotPalette.surface,
                    RoundedCornerShape(12.dp),
                )
                .padding(12.dp),
        ) {
            PilotText(if (message.outgoing) "You" else message.author, strong = true)
            PilotText(message.content)
        }
    }
}
