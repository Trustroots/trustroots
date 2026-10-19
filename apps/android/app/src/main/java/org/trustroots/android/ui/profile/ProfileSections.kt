package org.trustroots.android.ui.profile

import android.text.Html
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.theme.TrustrootsPaleGreen

internal enum class ProfileSection(val label: String) {
    About("About"),
    Contacts("Contacts"),
    Experiences("Experiences"),
}

@Composable
internal fun ProfileSectionBar(
    selected: ProfileSection,
    contactCount: Int,
    onSelect: (ProfileSection) -> Unit,
) {
    TabRow(selectedTabIndex = selected.ordinal, containerColor = TrustrootsPaleGreen, modifier = Modifier.fillMaxWidth().testTag("profileSections")) {
        ProfileSection.entries.forEach { section ->
            Tab(
                selected = section == selected,
                onClick = { onSelect(section) },
                modifier = Modifier.testTag("profileSection-${section.name.lowercase()}"),
                text = { Text(if (section == ProfileSection.Contacts && contactCount > 0) "Contacts ($contactCount)" else section.label) },
            )
        }
    }
}

@Composable
internal fun ProfileOverviewSection(
    references: List<ProfileReference>,
    showAllReferences: Boolean,
    onToggleReferences: () -> Unit,
    onOpenRelated: (String) -> Unit,
    api: MobileApiClient,
    session: MemberSession,
) {
    if (references.isEmpty()) Text("No experiences shared yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (references.isNotEmpty()) {
        Text("Experiences", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
        (if (showAllReferences) references else references.take(6)).forEach { reference ->
            Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RemoteArtwork(
                        reference.author.id?.let { api.avatarURL(it, 64) },
                        session.cookieHeader,
                        reference.author.label,
                        36.dp,
                    )
                    TextButton(onClick = { reference.author.username?.let(onOpenRelated) }) {
                        Text(reference.author.label)
                    }
                }
                reference.feedback?.let {
                    Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim())
                }
                reference.response?.let {
                    Text("Response: ${Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim()}")
                }
            }
        }
        if (references.size > 6) {
            TextButton(onClick = onToggleReferences) {
                Text(if (showAllReferences) "Show fewer" else "More experiences (${references.size - 6})")
            }
        }
    }
}

@Composable
internal fun ProfileAboutSection(member: MemberProfile, api: MobileApiClient) {
    member.description?.let {
        Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim())
    } ?: Text(
        "No about text yet.",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    if (member.languages.isNotEmpty()) {
        Text(
            "Languages: ${member.languages.joinToString { languageName(it) }}",
            modifier = Modifier.padding(top = 16.dp),
        )
    }
    if (member.circles.isNotEmpty()) {
        Text("Circles", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
        member.circles.forEach { circle ->
            Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                RemoteArtwork(
                    url = if (circle.image) api.circleImageURL(circle.slug) else null,
                    sessionCookie = null,
                    label = circle.label,
                    size = 40.dp,
                )
                Text(circle.label, modifier = Modifier.padding(start = 10.dp, top = 8.dp))
            }
        }
    }
}

@Composable
internal fun ProfileHostingSection(hosting: AccommodationOffer?, hostingLoaded: Boolean) {
    if (!hostingLoaded) {
        CircularProgressIndicator()
        return
    }
    val status = when (hosting?.status) {
        "yes" -> "Hosting travellers"
        "maybe" -> "Maybe hosting"
        else -> "Not hosting currently"
    }
    Text(status, fontWeight = FontWeight.Bold)
    hosting?.let { offer ->
        val details = if (offer.status == "yes" || offer.status == "maybe") {
            offer.description
        } else {
            offer.noOfferDescription
        }
        details?.let {
            Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim())
        }
        if (offer.status == "yes" || offer.status == "maybe") {
            offer.maxGuests?.let {
                Text(if (it == 1) "Space for 1 guest" else "Space for up to $it guests")
            }
        }
    }
}

@Composable
internal fun ProfileContactsSection(
    contacts: List<ProfileContact>,
    showAllContacts: Boolean,
    onToggleContacts: () -> Unit,
    onOpenRelated: (String) -> Unit,
    api: MobileApiClient,
    session: MemberSession,
) {
    if (contacts.isEmpty()) {
        Text(
            "People you connect with on Trustroots will appear here.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }
    (if (showAllContacts) contacts else contacts.take(6)).forEach { contact ->
        Row(
            Modifier
                .fillMaxWidth()
                .clickable { contact.user.username?.let(onOpenRelated) }
                .testTag("profileContact-${contact.id}")
                .padding(vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RemoteArtwork(
                contact.user.id?.let { api.avatarURL(it, 64) },
                session.cookieHeader,
                contact.user.label,
                36.dp,
            )
            Text(contact.user.label, modifier = Modifier.padding(start = 10.dp))
        }
    }
    if (contacts.size > 6) {
        TextButton(onClick = onToggleContacts) {
            Text(if (showAllContacts) "Show fewer" else "More contacts (${contacts.size - 6})")
        }
    }
}
