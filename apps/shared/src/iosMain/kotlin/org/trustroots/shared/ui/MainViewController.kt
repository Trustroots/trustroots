package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PlatformImeOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitInteropProperties
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.viewinterop.UIKitViewController
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UITextContentTypeUsername
import platform.UIKit.UIView
import platform.UIKit.UIViewController

fun MemberMenuViewController(
    buildInfo: String,
    onSelect: (MemberMenuAction) -> Unit,
) = ComposeUIViewController {
    Box(
        Modifier.fillMaxSize()
            .background(pilotPalette.background)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        MemberMenu(buildInfo, onSelect)
    }
}

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun MemberSignInViewController(
    gateway: PilotGateway,
    initialError: String?,
    onJoin: () -> Unit,
) = ComposeUIViewController {
    var busy by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        MemberSignIn(
            gateway = gateway,
            initialError = initialError,
            busy = busy,
            beginAction = {
                val available = !busy
                if (available) busy = true
                available
            },
            endAction = { busy = false },
            usernameKeyboard = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                autoCorrectEnabled = false,
                platformImeOptions = PlatformImeOptions { textContentType(UITextContentTypeUsername) },
            ),
            passwordKeyboard = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                platformImeOptions = PlatformImeOptions { isSecureTextEntry(true) },
            ),
            onJoin = onJoin,
        )
    }
}

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun MemberContactsViewController(
    state: MemberContactsState,
    onOpen: (String) -> Unit,
    onRetry: () -> Unit,
    createAvatar: (MemberContact) -> UIViewController,
) = ComposeUIViewController {
    MemberContacts(state, onOpen, onRetry) { contact ->
        key(contact.memberId, contact.name) {
            HostedMemberAvatar { createAvatar(contact) }
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun MemberInboxViewController(
    state: MemberInboxState,
    onFilter: (String) -> Unit,
    onOpen: (String) -> Unit,
    onRetry: () -> Unit,
    createAvatar: (MemberInboxThread) -> UIViewController,
) = ComposeUIViewController {
    MemberInbox(state, onFilter, onOpen, onRetry) { thread ->
        key(thread.memberId, thread.name) {
            HostedMemberAvatar { createAvatar(thread) }
        }
    }
}

data class MemberConversationContent(
    val messages: List<PilotMessage> = emptyList(),
    val draft: String = "",
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val loadError: String? = null,
    val replyError: String? = null,
    val experienceLabel: String? = null,
    val canShareExperience: Boolean = false,
)

class MemberConversationState {
    internal var content by mutableStateOf(MemberConversationContent())
        private set

    fun update(content: MemberConversationContent) {
        this.content = content
    }

    internal fun editDraft(draft: String) {
        content = content.copy(draft = draft)
    }
}

fun MemberConversationViewController(
    state: MemberConversationState,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    onRetry: () -> Unit,
    onShareExperience: () -> Unit,
) = ComposeUIViewController {
    val content = state.content
    val newestId = content.messages.firstOrNull()?.id
    val listState = rememberLazyListState()
    var scrollRequest by remember { mutableIntStateOf(0) }
    Column(
        modifier = Modifier.fillMaxSize().background(pilotPalette.background)
            .imePadding().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.TopCenter) {
            when {
                content.messages.isNotEmpty() ->
                    ConversationHistory(content.messages, listState, contentPadding = PaddingValues(vertical = 8.dp))
                content.isLoading -> PilotText("Loading conversation…", Modifier.padding(top = 8.dp))
                content.loadError != null -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PilotTitle("Conversation unavailable")
                    PilotError(content.loadError)
                    PilotButton("Try again", onClick = onRetry)
                }
            }
        }
        content.experienceLabel?.let { label ->
            if (content.canShareExperience) PilotButton(label, onClick = onShareExperience)
            else PilotText(label, strong = true)
        }
        ConversationReply(
            draft = content.draft,
            tag = "conversation-reply",
            sendLabel = "Send message",
            busy = content.isSending,
            error = content.replyError,
            onFocus = { scrollRequest++ },
            onDraft = { draft ->
                state.editDraft(draft)
                onDraft(draft)
            },
            onSend = onSend,
        )
    }
    LaunchedEffect(newestId, scrollRequest) {
        if (newestId != null) listState.scrollToItem(0)
    }
}

@OptIn(ExperimentalForeignApi::class)
fun MainViewController(
    gateway: PilotGateway,
    username: String?,
    initialError: String?,
    createConnectionsMap: (List<PilotMapPin>) -> UIView,
) = ComposeUIViewController {
    SharedComposeRoot(
        gateway,
        username,
        initialError,
        renderConnectionsMap = { ConnectionsMap(it, createConnectionsMap) },
    )
}

@OptIn(ExperimentalForeignApi::class)
fun SharedHomeViewController(
    gateway: PilotGateway,
    createConnectionsMap: (List<PilotMapPin>) -> UIView,
    openProfile: (String) -> Unit,
) = ComposeUIViewController {
    Box(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        MemberDashboard(
            accountKey = gateway,
            loadNotes = { awaitData(gateway::featuredNotes) },
            loadConnections = { awaitData(gateway::connections) },
            renderConnectionsMap = { ConnectionsMap(it, createConnectionsMap) },
            onConnection = openProfile,
            showTitle = false,
        )
    }
}

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
@Composable
private fun HostedMemberAvatar(createView: () -> UIViewController) {
    // Keep UIKit avatar touches inside the Compose row's tap target.
    UIKitViewController(
        factory = createView,
        modifier = Modifier.size(46.dp),
        properties = UIKitInteropProperties(interactionMode = null),
    )
}

@OptIn(ExperimentalForeignApi::class)
@Composable
private fun ConnectionsMap(pins: List<PilotMapPin>, createView: (List<PilotMapPin>) -> UIView) {
    key(pins) {
        UIKitView(
            factory = { createView(pins) },
            modifier = Modifier.fillMaxWidth().height(280.dp),
        )
    }
}
