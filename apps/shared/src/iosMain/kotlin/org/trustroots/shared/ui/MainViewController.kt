package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

fun OfferSearchFiltersViewController(
    state: OfferSearchFiltersState,
    onToggle: (OfferSearchToggle) -> Unit,
    onActivity: (OfferSearchActivity) -> Unit,
    onLanguages: () -> Unit,
    onCircle: (String) -> Unit,
) = ComposeUIViewController {
    OfferSearchFilters(state, onToggle, onActivity, onLanguages, onCircle)
}

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
fun MemberCirclesViewController(
    state: MemberCirclesState,
    onOpen: (String) -> Unit,
    onMembership: (String) -> Unit,
    onRetry: () -> Unit,
    onWiki: () -> Unit,
    createArtwork: (String) -> UIViewController,
) = ComposeUIViewController {
    MemberCircles(state, onOpen, onMembership, onRetry, onWiki) { circle ->
        UIKitViewController(
            factory = { createArtwork(circle.id) },
            modifier = Modifier.size(54.dp),
            properties = UIKitInteropProperties(interactionMode = null),
        )
    }
}

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun MemberCircleDetailViewController(
    state: MemberCircleDetailState,
    onBack: () -> Unit,
    onProfile: (String) -> Unit,
    onRetry: () -> Unit,
    onWiki: () -> Unit,
    createArtwork: () -> UIViewController,
    createAvatar: (CircleDetailMember) -> UIViewController,
) = ComposeUIViewController {
    MemberCircleDetail(
        state, onBack, onProfile, onRetry, onWiki,
        artwork = { modifier ->
            UIKitViewController(
                factory = createArtwork,
                modifier = modifier,
                properties = UIKitInteropProperties(interactionMode = null),
            )
        },
        avatar = { member ->
            key(member.memberId, member.name) {
                HostedMemberAvatar { createAvatar(member) }
            }
        },
    )
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

@OptIn(ExperimentalForeignApi::class)
fun MemberConversationViewController(
    state: MemberConversationState,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    onRetry: () -> Unit,
    onShareExperience: () -> Unit,
) = ComposeUIViewController {
    MemberConversation(state, onDraft, onSend, onRetry, onShareExperience)
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
            // MapKit can finish accessibility updates after its Compose wrapper detaches.
            onRelease = { map -> map.removeFromSuperview() },
        )
    }
}
