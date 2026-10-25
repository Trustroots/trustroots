package org.trustroots.android.ui.common

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

internal typealias LeaveGuard = (() -> Unit) -> Unit
internal val LocalLeaveGuard = compositionLocalOf<MutableState<LeaveGuard?>?> { null }

@Composable
internal fun NativeBackButton(onBack: () -> Unit, modifier: Modifier = Modifier, tint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface) {
    IconButton(onClick = onBack, modifier = modifier) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back), tint = tint)
    }
}

/** Shares the form's discard decision with system back and primary navigation. */
@Composable
internal fun rememberFormCancel(dirty: Boolean, saving: Boolean, onCancel: () -> Unit): () -> Unit {
    val leave = rememberFormLeave(dirty, saving, onCancel)
    return { leave(onCancel) }
}

@Composable
internal fun rememberFormLeave(dirty: Boolean, saving: Boolean, onCancel: () -> Unit): LeaveGuard {
    var pending by remember { mutableStateOf<(() -> Unit)?>(null) }
    val currentDirty by rememberUpdatedState(dirty)
    val currentSaving by rememberUpdatedState(saving)
    val guard: LeaveGuard = remember {
        { action ->
            if (!currentSaving) {
                if (currentDirty) pending = action else action()
            }
        }
    }
    val shellGuard = LocalLeaveGuard.current
    DisposableEffect(shellGuard, guard) {
        shellGuard?.value = guard
        onDispose { if (shellGuard?.value === guard) shellGuard.value = null }
    }
    BackHandler { guard(onCancel) }
    if (pending != null) {
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(stringResource(R.string.discard_changes_title)) },
            text = { Text(stringResource(R.string.unsaved_changes_lost)) },
            confirmButton = {
                TextButton(onClick = {
                    val action = pending
                    pending = null
                    if (shellGuard?.value === guard) shellGuard.value = null
                    action?.invoke()
                }) {
                    Text(stringResource(R.string.discard_changes))
                }
            },
            dismissButton = { TextButton(onClick = { pending = null }) { Text(stringResource(R.string.keep_editing)) } },
        )
    }
    return guard
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
internal fun FormActionBar(
    title: String,
    saving: Boolean,
    canSave: Boolean,
    onCancel: () -> Unit,
    onSave: () -> Unit,
    scrollBehavior: TopAppBarScrollBehavior,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    TopAppBar(
        title = {
            Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis)
        },
        scrollBehavior = scrollBehavior,
        modifier = Modifier.padding(contentPadding.horizontalInset()),
        windowInsets = WindowInsets(
            left = 0.dp,
            top = contentPadding.calculateTopPadding(),
            right = 0.dp,
            bottom = 0.dp,
        ),
        navigationIcon = {
            IconButton(onClick = onCancel, enabled = !saving) {
                Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel))
            }
        },
        actions = {
            TextButton(onClick = onSave, enabled = canSave && !saving) {
                Text(if (saving) stringResource(R.string.saving) else stringResource(R.string.save_changes))
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
    )
}
