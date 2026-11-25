package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

data class MemberContact(
    val id: String,
    val memberId: String?,
    val username: String?,
    val name: String,
    val handle: String?,
    val pending: Boolean,
)

class MemberContactsState {
    internal var content by mutableStateOf(MemberContactsContent())
        private set

    fun update(contacts: List<MemberContact>, isLoading: Boolean, error: String?) {
        content = MemberContactsContent(contacts, isLoading, error)
    }
}

internal data class MemberContactsContent(
    val contacts: List<MemberContact> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

@Composable
internal fun MemberContacts(
    state: MemberContactsState,
    onOpen: (String) -> Unit,
    onRetry: () -> Unit,
    avatar: @Composable (MemberContact) -> Unit,
) {
    val content = state.content
    val palette = pilotPalette
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(palette.background),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { PilotTitle("Contacts") }
        when {
            content.isLoading && content.contacts.isEmpty() -> item { PilotText("Loading contacts…") }
            content.error != null -> item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PilotTitle("Contacts unavailable")
                    PilotError(content.error)
                    PilotButton("Try again", onClick = onRetry)
                }
            }
            content.contacts.isEmpty() -> item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    PilotTitle("No contacts yet")
                    PilotText("People you connect with on Trustroots will appear here.")
                }
            }
            else -> items(content.contacts, key = { it.id }) { contact ->
                val action = contact.username?.let { username ->
                    Modifier.clickable(role = Role.Button) { onOpen(username) }
                } ?: Modifier
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .background(palette.surface).then(action)
                        .testTag("contact-${contact.id}").padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    avatar(contact)
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        PilotText(contact.name, strong = true)
                        contact.handle?.let { PilotText(it) }
                        if (contact.pending) PilotText("Awaiting confirmation", colour = palette.accent)
                    }
                }
            }
        }
    }
}
