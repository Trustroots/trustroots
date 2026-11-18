package org.trustroots.android.ui.startup

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
internal fun StartupTransition(
    isStarting: Boolean,
    content: @Composable () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        if (!isStarting) content()
        // Compose honours the system duration scale; the overlay consumes no input.
        AnimatedVisibility(
            visible = isStarting,
            enter = EnterTransition.None,
            exit = fadeOut(animationSpec = tween(180)),
        ) {
            StartupScreen(null)
        }
    }
}
