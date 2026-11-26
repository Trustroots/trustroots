package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

interface MemberSupportGateway {
    fun send(message: String, completion: (String?) -> Unit)
}

@Composable
internal fun MemberSupport(gateway: MemberSupportGateway, onFAQ: () -> Unit) {
    var draft by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var sent by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current

    Box(
        Modifier.fillMaxSize().background(pilotPalette.background).imePadding().padding(16.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(Modifier.widthIn(max = 600.dp).fillMaxWidth().testTag("member-support")) {
            PilotForm(spacing = 16.dp) {
                PilotTitle("Contact and support")
                if (sent) {
                    Column(
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        PilotTitle("Message sent")
                        PilotText("Trustroots support will get back to you as soon as they can.")
                    }
                } else {
                    PilotText("Tell the Trustroots support team how they can help.")
                    PilotInput(
                        label = "Message",
                        value = draft,
                        tag = "support-message",
                        enabled = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                        singleLine = false,
                        onChange = { draft = it },
                    )
                    error?.let { PilotError(it) }

                    PilotButton(
                        if (isSending) "Sending message…" else "Send message",
                        enabled = draft.isNotBlank() && !isSending,
                        primary = true,
                        modifier = Modifier.fillMaxWidth().testTag("support-send"),
                    ) {
                        val message = draft.trim()
                        if (message.isNotEmpty() && !isSending) {
                            isSending = true
                            error = null
                            focus.clearFocus()
                            scope.launch {
                                error = awaitAction { gateway.send(message, it) }
                                isSending = false
                                if (error == null) {
                                    draft = ""
                                    sent = true
                                }
                            }
                        }
                    }

                    Column(
                        Modifier.fillMaxWidth().background(pilotPalette.surface, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        PilotText("Quick help", strong = true)
                        PilotText("You may find an answer before sending a message.")
                        PilotButton(
                            "Browse frequently asked questions",
                            modifier = Modifier.testTag("support-faq"),
                        ) {
                            focus.clearFocus()
                            onFAQ()
                        }
                        PilotText("For urgent safety concerns, contact local emergency services first.")
                    }
                }
            }
        }
    }
}
