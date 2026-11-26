package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.window.ComposeUIViewController

@OptIn(ExperimentalComposeUiApi::class)
fun MapOfferStatusViewController(
    state: MapOfferStatusState,
    onHeight: (Double) -> Unit,
) = ComposeUIViewController(configure = { opaque = false }) {
    state.content?.let { content ->
        MeasuredMapContent(onHeight, alignment = Alignment.TopEnd) { modifier ->
            MapOfferStatus(content, modifier)
        }
    }
}

@Composable
internal fun MeasuredMapContent(
    onHeight: (Double) -> Unit,
    alignment: Alignment = Alignment.TopStart,
    content: @Composable (Modifier) -> Unit,
) {
    val density = LocalDensity.current
    Box(
        Modifier.fillMaxWidth().wrapContentHeight(align = Alignment.Top, unbounded = true),
        contentAlignment = alignment,
    ) {
        content(Modifier.onSizeChanged {
            onHeight(with(density) { it.height.toDp().value.toDouble() })
        })
    }
}
