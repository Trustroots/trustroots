package org.trustroots.android.ui.account

import android.Manifest
import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.delay
import okhttp3.WebSocket
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.browser.BrowserNostrSession
import org.trustroots.android.nostr.AndroidNostranslationSession
import org.trustroots.android.nostr.NostranslationConnectionLink
import org.trustroots.android.nostr.nostrAccountScope
import org.trustroots.android.notifications.NostranslationAlerts
import org.trustroots.android.ui.common.canPostNotifications
import org.trustroots.android.ui.common.requireActivity

@Composable
internal fun NostranslationEntry(
    api: MobileApiClient,
    session: MemberSession,
    activeSession: BrowserNostrSession?,
    enabled: Boolean,
    sockets: WebSocket.Factory = NostrootsNotesClient.sharedWebSocketFactory,
    currentTimeSeconds: () -> Long = { System.currentTimeMillis() / 1000 },
) {
    var dialogSession by remember(activeSession) { mutableStateOf<BrowserNostrSession?>(null) }
    TextButton(onClick = { dialogSession = activeSession }, enabled = enabled && activeSession != null) {
        Text(stringResource(R.string.nostranslation_signing))
    }
    if (enabled) {
        dialogSession?.let { signingSession ->
            NostranslationDialog(api, session, signingSession, sockets = sockets, currentTimeSeconds = currentTimeSeconds) {
                dialogSession = null
            }
        }
    }
}

@Composable
internal fun NostranslationDialog(
    api: MobileApiClient,
    session: MemberSession,
    activeSession: BrowserNostrSession,
    openedFromAlert: Boolean = false,
    sockets: WebSocket.Factory = NostrootsNotesClient.sharedWebSocketFactory,
    currentTimeSeconds: () -> Long = { System.currentTimeMillis() / 1000 },
    close: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val activity = context.requireActivity(Activity::class.java, "Nostranslation must be hosted by an Activity.")
    val alertStatus by NostranslationAlerts.status.collectAsState()
    var alertsEnabled by remember(context, api.backendURL, session.member.username) {
        mutableStateOf(NostranslationAlerts.isEnabled(context, api.backendURL, session))
    }
    DisposableEffect(context, api.backendURL, session.member.username) {
        val stopObserving = NostranslationAlerts.observeEnabled(context, api.backendURL, session) { alertsEnabled = it }
        onDispose(stopObserving)
    }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        if (allowed) NostranslationAlerts.enable(activity, api, session)
        else NostranslationAlerts.registrationFailed()
    }
    val signer = remember(activeSession) {
        AndroidNostranslationSession(
            nostrAccountScope(api.backendURL, session.member.username), activeSession.keys, scope, activeSession::isActive, sockets,
            now = currentTimeSeconds,
        )
    }
    var input by remember { mutableStateOf("") }
    var pairing by remember { mutableStateOf<NostranslationConnectionLink?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var scanning by remember { mutableStateOf(false) }
    var now by remember { mutableStateOf(currentTimeSeconds()) }
    val failed = stringResource(R.string.nostranslation_action_failed)
    val invalid = stringResource(R.string.nostranslation_invalid_link)
    val scanPrompt = stringResource(R.string.nostranslation_scan_qr)

    fun reviewLink(link: String) {
        pairing = NostranslationConnectionLink.parse(link)
        error = if (pairing == null) invalid else null
    }

    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        scanning = false
        result.contents?.let(::reviewLink)
    }
    val readTime by rememberUpdatedState(currentTimeSeconds)

    fun launchScanner() {
        val options = ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt(scanPrompt).setBeepEnabled(false).setBarcodeImageEnabled(false)
        scanning = true
        runCatching { scanner.launch(options) }.onFailure {
            scanning = false
            error = failed
        }
    }

    fun revokeClient(peer: String) {
        runCatching { signer.revoke(peer) }.onFailure { error = failed }
    }

    DisposableEffect(signer) {
        runCatching(signer::start).onFailure { error = failed }
        onDispose(signer::close)
    }
    LaunchedEffect(signer, openedFromAlert, alertsEnabled) {
        if (openedFromAlert && alertsEnabled) {
            signer.recoverPending { transport -> api.pendingTranslationAlerts(session, transport) }
        }
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { if (!scanning) close() }
    LaunchedEffect(signer) {
        while (true) {
            now = readTime()
            delay(1000)
        }
    }
    LaunchedEffect(signer.connectedClients) {
        NostranslationAlerts.reconcile(context, api, session)
    }

    val candidate = pairing
    val review = signer.reviews.firstOrNull()
    val secure = DialogProperties(securePolicy = SecureFlagPolicy.SecureOn)
    when {
        candidate != null -> AlertDialog(
            onDismissRequest = { pairing = null },
            title = { Text(stringResource(R.string.nostranslation_pair)) },
            text = { Text(stringResource(R.string.nostranslation_connection_details, candidate.clientURL, candidate.relay)) },
            confirmButton = {
                TextButton(onClick = {
                    pairing = null
                    input = ""
                    runCatching { signer.pair(candidate) }.onFailure { error = failed }
                }) { Text(stringResource(R.string.nostranslation_pair)) }
            },
            dismissButton = { TextButton(onClick = { pairing = null }) { Text(stringResource(R.string.cancel)) } },
            properties = secure,
        )
        review != null -> {
            val expired = now > review.approval.expiresAt
            AlertDialog(
                onDismissRequest = { runCatching { signer.decide(review, false) }.onFailure { error = failed } },
                title = { Text(stringResource(R.string.nostranslation_authorise)) },
                text = { Text(if (expired) stringResource(R.string.nostranslation_expired) else review.approval.destination) },
                confirmButton = {
                    TextButton(onClick = {
                        runCatching { signer.decide(review, !expired) }.onFailure { error = failed }
                    }) {
                        Text(stringResource(if (expired) R.string.nostr_done else R.string.nostranslation_approve))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { runCatching { signer.decide(review, false) }.onFailure { error = failed } }) {
                        Text(stringResource(R.string.nostranslation_deny))
                    }
                },
                properties = secure,
            )
        }
        else -> AlertDialog(
            onDismissRequest = close,
            title = { Text(stringResource(R.string.nostranslation_signing)) },
            text = {
                Column(Modifier.heightIn(max = 450.dp).verticalScroll(rememberScrollState())) {
                    TextField(
                        value = input,
                        onValueChange = { if (it.length <= 2_048) input = it },
                        label = { Text(stringResource(R.string.nostranslation_paste_link)) },
                        singleLine = true,
                    )
                    TextButton(onClick = { reviewLink(input) }, enabled = input.isNotBlank()) {
                        Text(stringResource(R.string.nostranslation_review_link))
                    }
                    TextButton(onClick = ::launchScanner) { Text(scanPrompt) }
                    signer.connectedClients.forEach { peer ->
                        Text(stringResource(R.string.nostranslation_client, peer.take(12)))
                        TextButton(onClick = { revokeClient(peer) }) {
                            Text(stringResource(R.string.nostranslation_revoke))
                        }
                    }
                    if (signer.connectedClients.isNotEmpty()) {
                        TextButton(onClick = {
                            if (alertsEnabled) NostranslationAlerts.disable(context, api, session)
                            else if (!context.canPostNotifications()) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                            else NostranslationAlerts.enable(activity, api, session)
                        }) {
                            Text(stringResource(if (alertsEnabled) R.string.nostranslation_disable_alerts else R.string.nostranslation_enable_alerts))
                        }
                        alertStatus?.let { Text(stringResource(it)) }
                    }
                    if (openedFromAlert) Text(stringResource(R.string.nostranslation_no_pending_review))
                    if (signer.relayFailed) Text(stringResource(R.string.nostranslation_relay_failed))
                    error?.let { Text(it) }
                }
            },
            confirmButton = { TextButton(onClick = close) { Text(stringResource(R.string.nostr_done)) } },
            properties = secure,
        )
    }
}
