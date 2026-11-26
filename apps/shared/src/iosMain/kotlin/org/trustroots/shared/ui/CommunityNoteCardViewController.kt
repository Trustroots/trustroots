package org.trustroots.shared.ui

import androidx.compose.foundation.layout.size
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitInteropProperties
import androidx.compose.ui.viewinterop.UIKitView
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIView

@OptIn(ExperimentalComposeUiApi::class, ExperimentalForeignApi::class)
fun CommunityNoteCardViewController(
    state: CommunityNoteCardState,
    onDismiss: () -> Unit,
    onHeight: (Double) -> Unit,
    createIcon: () -> UIView,
) = ComposeUIViewController(configure = { opaque = false }) {
    state.content?.let { content ->
        MeasuredMapContent(onHeight) { modifier ->
            CommunityNoteCard(
                content,
                onDismiss,
                icon = {
                    UIKitView(
                        factory = createIcon,
                        modifier = Modifier.size(17.dp),
                        properties = UIKitInteropProperties(interactionMode = null),
                    )
                },
                modifier = modifier,
            )
        }
    }
}
