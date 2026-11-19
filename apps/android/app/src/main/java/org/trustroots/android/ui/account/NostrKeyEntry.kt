package org.trustroots.android.ui.account

import android.app.Activity
import android.app.KeyguardManager
import android.content.ClipData
import android.content.ClipboardManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.nostr.AndroidNostrKeys
import org.trustroots.android.nostr.nostrAccountScope

@Composable
internal fun NostrKeyEntry(api: MobileApiClient, session: MemberSession, enabled: Boolean) {
    var open by remember { mutableStateOf(false) }
    TextButton(onClick = { open = true }, enabled = enabled) { Text(stringResource(R.string.nostr_key)) }
    if (open && enabled) NostrKeyDialog(api, session, onClose = { open = false })
}

@Suppress("DEPRECATION") // System credential activity also supports API 26–29.
@Composable
private fun NostrKeyDialog(api: MobileApiClient, session: MemberSession, onClose: () -> Unit) {
    val context = LocalContext.current
    val store = remember(context, api.backendURL, session.member.username) {
        AndroidNostrKeys(context, nostrAccountScope(api.backendURL, session.member.username))
    }
    val scope = rememberCoroutineScope()
    var publicKey by remember { mutableStateOf<String?>(null) }
    var linkedKey by remember { mutableStateOf<Result<String?>?>(null) }
    var input by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<Int?>(null) }
    var busy by remember { mutableStateOf(true) }
    var ready by remember { mutableStateOf(false) }
    var confirmRemoval by remember { mutableStateOf(false) }
    var awaitingCredential by remember { mutableStateOf(false) }
    var foregroundVersion by remember { mutableStateOf(0) }
    val title = stringResource(R.string.nostr_key)
    val backupLabel = stringResource(R.string.nostr_backup)
    val keyguard = context.getSystemService(KeyguardManager::class.java)

    LaunchedEffect(store) {
        withContext(Dispatchers.IO) { runCatching(store::publicKey) }.fold(
            onSuccess = { publicKey = it; ready = true },
            onFailure = { error = R.string.nostr_storage_error },
        )
        busy = false
    }
    LaunchedEffect(api, session.member.username) { linkedKey = api.linkedNostrKey(session) }

    val credential = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (awaitingCredential && result.resultCode == Activity.RESULT_OK) {
            val version = foregroundVersion
            busy = true
            scope.launch {
                val backup = withContext(Dispatchers.IO) { runCatching(store::backup) }
                if (version == foregroundVersion) {
                    backup.fold(
                        onSuccess = { secret = it },
                        onFailure = { error = R.string.nostr_storage_error },
                    )
                }
                busy = false
            }
        }
        awaitingCredential = false
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        foregroundVersion++
        secret = null
        input = ""
    }

    fun update(operation: () -> String?) {
        error = null
        busy = true
        scope.launch {
            withContext(Dispatchers.IO) { runCatching(operation) }.fold(
                onSuccess = { publicKey = it; input = "" },
                onFailure = {
                    error = if (it is IllegalArgumentException) R.string.nostr_invalid_key else R.string.nostr_storage_error
                },
            )
            busy = false
        }
    }

    val secure = DialogProperties(securePolicy = SecureFlagPolicy.SecureOn)
    if (confirmRemoval) {
        AlertDialog(
            onDismissRequest = { confirmRemoval = false },
            title = { Text(stringResource(R.string.nostr_remove)) },
            text = { Text(stringResource(R.string.nostr_remove_explanation)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmRemoval = false
                    secret = null
                    update { store.remove(); null }
                }) { Text(stringResource(R.string.nostr_remove)) }
            },
            dismissButton = {
                TextButton(onClick = { confirmRemoval = false }) { Text(stringResource(R.string.cancel)) }
            },
            properties = secure,
        )
        return
    }

    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(title) },
        text = {
            Column(Modifier.heightIn(max = 450.dp).verticalScroll(rememberScrollState())) {
                Text(stringResource(R.string.nostr_profile_public))
                val linked = linkedKey
                when {
                    linked == null -> Text(stringResource(R.string.nostr_loading))
                    linked.isFailure -> Text(stringResource(R.string.nostr_profile_unavailable))
                    else -> SelectionContainer {
                        Text(linked.getOrNull() ?: stringResource(R.string.nostr_no_profile_key))
                    }
                }
                Text(stringResource(R.string.nostr_local_public))
                val npub = publicKey
                when {
                    npub != null -> {
                        SelectionContainer { Text(npub) }
                        TextButton(onClick = {
                            context.getSystemService(ClipboardManager::class.java)
                                .setPrimaryClip(ClipData.newPlainText("npub", npub))
                        }) { Text(stringResource(R.string.nostr_copy_public)) }
                        val backup = secret
                        if (backup == null) {
                            TextButton(enabled = !busy && !awaitingCredential, onClick = {
                                error = null
                                val prompt = keyguard?.createConfirmDeviceCredentialIntent(title, backupLabel)
                                if (prompt == null) {
                                    error = R.string.nostr_device_lock_required
                                } else {
                                    awaitingCredential = true
                                    credential.launch(prompt)
                                }
                            }) { Text(backupLabel) }
                        } else {
                            Text(stringResource(R.string.nostr_secret_label))
                            Text(backup)
                            TextButton(onClick = { secret = null }) { Text(stringResource(R.string.nostr_hide_secret)) }
                        }
                        TextButton(enabled = !busy && !awaitingCredential, onClick = { confirmRemoval = true; secret = null }) {
                            Text(stringResource(R.string.nostr_remove))
                        }
                    }
                    ready -> {
                        Text(stringResource(R.string.nostr_no_local_key))
                        TextField(
                            value = input,
                            onValueChange = { if (it.length <= 128) input = it },
                            label = { Text(stringResource(R.string.nostr_import_label)) },
                            enabled = !busy,
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
                        )
                        TextButton(enabled = !busy && input.isNotBlank(), onClick = {
                            val candidate = input
                            input = ""
                            update { store.import(candidate) }
                        }) { Text(stringResource(R.string.nostr_import)) }
                        TextButton(enabled = !busy, onClick = { update(store::generate) }) {
                            Text(stringResource(R.string.nostr_generate))
                        }
                    }
                }
                error?.let { Text(stringResource(it)) }
            }
        },
        confirmButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.nostr_done)) } },
        properties = secure,
    )
}
