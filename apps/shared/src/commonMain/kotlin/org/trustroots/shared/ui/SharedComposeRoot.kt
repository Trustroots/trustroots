package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

private sealed interface Destination {
    data class Profile(val username: String) : Destination
    data object Inbox : Destination
    data class Conversation(val partner: PilotPerson, val memberId: String) : Destination
}

@Composable
fun SharedComposeRoot(
    gateway: PilotGateway,
    username: String?,
    initialError: String?,
    installBackHandler: @Composable (Boolean, () -> Unit) -> Unit = { _, _ -> },
) {
    val start = username?.let { listOf(Destination.Profile(it)) }.orEmpty()
    var history by remember(username) { mutableStateOf<List<Destination>>(start) }
    var busy by remember(username) { mutableStateOf(false) }
    val destination = history.lastOrNull()
    val beginAction = {
        val available = !busy
        if (available) busy = true
        available
    }
    val endAction = { busy = false }
    val goBack = {
        if (!busy) {
            if (history.size > 1) history = history.dropLast(1) else gateway.exit()
        }
    }
    // Let the platform dismiss an open keyboard before it dispatches Back to the journey.
    installBackHandler(true, goBack)

    Box(
        Modifier.fillMaxSize().background(pilotPalette.background).safeDrawingPadding().imePadding(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(Modifier.widthIn(max = 600.dp).fillMaxSize().padding(horizontal = 16.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PilotTitle("Trustroots")
                if (history.size > 1) {
                    PilotButton("Back", enabled = !busy, onClick = goBack)
                } else {
                    PilotButton("Open native app", enabled = !busy, onClick = goBack)
                }
            }
            key(destination) {
                when (destination) {
                    null -> SignIn(gateway, initialError, busy, beginAction, endAction)
                    is Destination.Profile -> Profile(
                        gateway = gateway,
                        username = destination.username,
                        isOwnProfile = destination.username == username,
                        onInbox = { history = history + Destination.Inbox },
                        onConversation = { partner, memberId ->
                            history = history + Destination.Conversation(partner, memberId)
                        },
                        busy = busy,
                        beginAction = beginAction,
                        endAction = endAction,
                    )
                    Destination.Inbox -> Inbox(
                        gateway = gateway,
                        onProfile = { history = history + Destination.Profile(it) },
                        onConversation = { partner, memberId ->
                            history = history + Destination.Conversation(partner, memberId)
                        },
                    )
                    is Destination.Conversation -> Conversation(
                        gateway = gateway,
                        partner = destination.partner,
                        memberId = destination.memberId,
                        busy = busy,
                        beginAction = beginAction,
                        endAction = endAction,
                    )
                }
            }
        }
    }
}

@Composable
private fun SignIn(
    gateway: PilotGateway,
    initialError: String?,
    busy: Boolean,
    beginAction: () -> Boolean,
    endAction: () -> Unit,
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var failure by remember(initialError) { mutableStateOf(initialError) }
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current

    PilotForm {
        PilotTitle("Sign in")
        PilotInput(
            label = "Username or email",
            value = username,
            tag = "pilot-username",
            enabled = !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, autoCorrectEnabled = false),
            onChange = { username = it },
        )
        PilotInput(
            label = "Password",
            value = password,
            tag = "pilot-password",
            enabled = !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            onChange = { password = it },
        )
        failure?.let { PilotError(it) }
        PilotButton(
            "Sign in",
            primary = true,
            enabled = !busy && username.isNotBlank() && password.isNotEmpty(),
        ) {
            if (!beginAction()) return@PilotButton
            val enteredUsername = username.trim()
            val enteredPassword = password
            failure = null
            focus.clearFocus()
            scope.launch {
                failure = awaitAction { gateway.signIn(enteredUsername, enteredPassword, it) }
                if (failure == null) password = ""
                endAction()
            }
        }
        if (busy) PilotText("Signing in…")
    }
}

@Composable
internal fun PilotForm(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}
