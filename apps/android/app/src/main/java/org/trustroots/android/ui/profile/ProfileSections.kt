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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalConfiguration
import org.trustroots.android.ui.common.languageName
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.ui.common.localizedLabel
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.ui.common.RemoteArtwork

internal enum class ProfileSection(val label: Int) {
    About(R.string.profile_section_about),
    Contacts(R.string.profile_section_contacts),
    Experiences(R.string.profile_section_experiences),
}

@Composable
internal fun ProfileSectionBar(
    selected: ProfileSection,
    contactCount: Int,
    onSelect: (ProfileSection) -> Unit,
) {
    val artworkForeground = colorResource(R.color.artwork_on_scrim)
    val tabs: @Composable () -> Unit = {
        ProfileSection.entries.forEach { section ->
            Tab(
                selected = section == selected,
                onClick = { onSelect(section) },
                modifier = Modifier.drawBehind {
                    if (section == selected) {
                        val strokeWidth = 2.dp.toPx()
                        drawLine(
                            color = artworkForeground,
                            start = Offset(0f, size.height - strokeWidth / 2),
                            end = Offset(size.width, size.height - strokeWidth / 2),
                            strokeWidth = strokeWidth,
                        )
                    }
                }.testTag("profileSection-${section.name.lowercase()}"),
                text = {
                    Text(
                        if (section == ProfileSection.Contacts && contactCount > 0) {
                            pluralStringResource(R.plurals.profile_section_contacts_count, contactCount, contactCount)
                        } else {
                            stringResource(section.label)
                        },
                        color = artworkForeground,
                        fontWeight = if (section == selected) FontWeight.SemiBold else FontWeight.Normal,
                    )
                },
            )
        }
    }
    TabRow(
        selectedTabIndex = selected.ordinal,
        containerColor = Color.Transparent,
        contentColor = artworkForeground,
        indicator = {},
        modifier = Modifier.fillMaxWidth().testTag("profileSections"),
        tabs = { tabs() },
    )
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
    if (references.isEmpty()) Text(stringResource(R.string.profile_no_experiences), color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (references.isNotEmpty()) {
        Text(stringResource(R.string.profile_section_experiences), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
        (if (showAllReferences) references else references.take(6)).forEach { reference ->
            Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RemoteArtwork(
                        reference.author.id?.let { api.avatarURL(it, 64) },
                        session.cookieHeader,
                        reference.author.localizedLabel(),
                        36.dp,
                    )
                    TextButton(onClick = { reference.author.username?.let(onOpenRelated) }) {
                        Text(reference.author.localizedLabel())
                    }
                }
                reference.feedback?.let {
                    Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim())
                }
                reference.response?.let {
                    Text(stringResource(R.string.profile_response_prefix, Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim()))
                }
            }
        }
        if (references.size > 6) {
            TextButton(onClick = onToggleReferences) {
                Text(if (showAllReferences) stringResource(R.string.profile_show_fewer) else pluralStringResource(R.plurals.profile_more_experiences, references.size - 6, references.size - 6))
            }
        }
    }
}

@Composable
internal fun ProfileAboutSection(member: MemberProfile, api: MobileApiClient) {
    val languageLocale = LocalConfiguration.current.locales[0]
    member.description?.let {
        Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim())
    } ?: Text(
        stringResource(R.string.profile_no_about),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    if (member.languages.isNotEmpty()) {
        Text(
            stringResource(R.string.profile_languages_prefix, member.languages.joinToString { languageName(it, languageLocale) }),
            modifier = Modifier.padding(top = 16.dp),
        )
    }
    if (member.circles.isNotEmpty()) {
        Text(stringResource(R.string.profile_circles_heading), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
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
        "yes" -> stringResource(R.string.profile_hosting_yes)
        "maybe" -> stringResource(R.string.profile_hosting_maybe)
        else -> stringResource(R.string.profile_hosting_no)
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
                Text(pluralStringResource(R.plurals.profile_hosting_guest_space, it, it))
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
            stringResource(R.string.profile_contacts_empty),
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
                contact.user.localizedLabel(),
                36.dp,
            )
            Text(contact.user.localizedLabel(), modifier = Modifier.padding(start = 10.dp))
        }
    }
    if (contacts.size > 6) {
        TextButton(onClick = onToggleContacts) {
            Text(if (showAllContacts) stringResource(R.string.profile_show_fewer) else pluralStringResource(R.plurals.profile_more_contacts, contacts.size - 6, contacts.size - 6))
        }
    }
}
