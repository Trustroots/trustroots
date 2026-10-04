package org.trustroots.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.ImeAction
import android.text.Html
import kotlinx.coroutines.launch
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MessageDraftStore
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.api.ProfileUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.ui.theme.TrustrootsPaleGreen
import java.util.Locale
import java.text.SimpleDateFormat
import java.util.Date

/** Matches `config.featureFlags.reference` (enabled in production and development). */
private const val referencesEnabled = true

@Composable
internal fun MemberSearchScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onProfileOpenChange: (Boolean) -> Unit = {},
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<MemberProfile>>(emptyList()) }
    var selected by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(selected) { onProfileOpenChange(selected != null) }
    var loading by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val search: () -> Unit = search@{
        if (query.trim().length < 3 || loading) return@search
        scope.launch {
            loading = true
            error = null
            api.searchMembers(session, query).onSuccess { results = it; searched = true }
                .onFailure {
                    if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                    else error = it.message ?: "Could not search members."
                }
            loading = false
        }
    }
    selected?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated) { selected = null }
        return
    }
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Find members", style = MaterialTheme.typography.headlineMedium)
        Text("Search by name or username.")
        OutlinedTextField(
            value = query,
            onValueChange = { query = it; searched = false; error = null; results = emptyList() },
            label = { Text("Name or username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { search() }),
            trailingIcon = {
                TextButton(onClick = search, enabled = query.trim().length >= 3 && !loading) {
                    Text("Search")
                }
            },
        )
        if (query.trim().isNotEmpty() && query.trim().length < 3) Text("Enter at least 3 characters.")
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (searched && results.isEmpty()) Text("No members found. Try another name or username.")
        Column(Modifier.verticalScroll(rememberScrollState())) {
            results.forEach { member ->
                Row(Modifier.fillMaxWidth().clickable { selected = member.username }.padding(vertical = 12.dp)) {
                    RemoteArtwork(
                        url = member.id?.let { api.avatarURL(it, 64) },
                        sessionCookie = session.cookieHeader,
                        label = member.displayName,
                        size = 54.dp,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(member.displayName, fontWeight = FontWeight.Bold)
                        Text("@${member.username}")
                        member.location?.let { Text(it) }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
internal fun MemberProfileScreen(
    api: MobileApiClient,
    session: MemberSession,
    username: String,
    onSessionInvalidated: () -> Unit,
    onOwnProfileSaved: (MemberProfile) -> Unit = {},
    startInEditMode: Boolean = false,
    onBack: () -> Unit,
) {
    var profile by remember(username) { mutableStateOf<MemberProfile?>(null) }
    var hosting by remember(username) { mutableStateOf<AccommodationOffer?>(null) }
    var hostingLoaded by remember(username) { mutableStateOf(false) }
    var error by remember(username) { mutableStateOf<String?>(null) }
    var recipient by remember(username) { mutableStateOf<MessageMember?>(null) }
    var relatedUsername by remember(username) { mutableStateOf<String?>(null) }
    var contacts by remember(username) { mutableStateOf<List<ProfileContact>>(emptyList()) }
    var references by remember(username) { mutableStateOf<List<ProfileReference>>(emptyList()) }
    var showAllContacts by remember(username) { mutableStateOf(false) }
    var showAllReferences by remember(username) { mutableStateOf(false) }
    var editing by remember(username) { mutableStateOf(startInEditMode) }
    var section by remember(username) { mutableStateOf(ProfileSection.Overview) }
    var browserRoute by remember(username) { mutableStateOf<BrowserRoute?>(null) }
    var relationship by remember(username) { mutableStateOf<ContactRelationship?>(null) }
    var relationshipResolved by remember(username) { mutableStateOf(false) }
    var confirmRemoveContact by remember(username) { mutableStateOf(false) }
    var removingContact by remember(username) { mutableStateOf(false) }
    var sharingExperience by remember(username) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    BackHandler {
        when {
            confirmRemoveContact -> if (!removingContact) confirmRemoveContact = false
            browserRoute != null -> browserRoute = null
            recipient != null -> recipient = null
            relatedUsername != null -> relatedUsername = null
            sharingExperience -> sharingExperience = false
            editing -> editing = false
            else -> onBack()
        }
    }
    if (editing && profile != null) {
        EditProfileScreen(
            api, session, requireNotNull(profile), onSessionInvalidated,
            onCancel = { editing = false },
            onSaved = { updated -> profile = updated; editing = false; onOwnProfileSaved(updated) },
        )
        return
    }
    if (sharingExperience && profile?.id != null) {
        CreateExperienceScreen(
            api = api,
            session = session,
            memberID = requireNotNull(profile).id!!,
            memberLabel = requireNotNull(profile).displayName,
            onSessionInvalidated = onSessionInvalidated,
            onBack = { sharingExperience = false },
            onCreated = { sharingExperience = false },
        )
        return
    }
    relatedUsername?.let { related ->
        MemberProfileScreen(api, session, related, onSessionInvalidated) { relatedUsername = null }
        return
    }
    recipient?.let {
        ConversationScreen(api, session, it, onSessionInvalidated, onBack = { recipient = null })
        return
    }
    browserRoute?.let { route ->
        TrustrootsBrowser(route = route, onClose = { browserRoute = null })
        return
    }
    if (confirmRemoveContact) {
        val existing = relationship
        AlertDialog(
            onDismissRequest = { if (!removingContact) confirmRemoveContact = false },
            title = {
                Text(
                    if (existing?.confirmed == true) "Remove contact?" else "Delete contact request?",
                )
            },
            text = {
                Text(
                    if (existing?.confirmed == true) {
                        "You will no longer be contacts with this member."
                    } else {
                        "This cancels the pending contact request."
                    },
                )
            },
            confirmButton = {
                TextButton(
                    enabled = !removingContact && existing?.id != null,
                    onClick = {
                        val contactID = existing?.id ?: return@TextButton
                        scope.launch {
                            removingContact = true
                            api.removeContact(session, contactID).onSuccess {
                                relationship = ContactRelationship(id = null, confirmed = false)
                                confirmRemoveContact = false
                            }.onFailure {
                                if ((it as? MobileApiException)?.isAuthenticationFailure == true) {
                                    onSessionInvalidated()
                                }
                            }
                            removingContact = false
                        }
                    },
                ) { Text(if (removingContact) "Removing…" else "Confirm") }
            },
            dismissButton = {
                TextButton(enabled = !removingContact, onClick = { confirmRemoveContact = false }) {
                    Text("Cancel")
                }
            },
        )
    }
    LaunchedEffect(username) {
        if (profile != null) return@LaunchedEffect
        api.profile(session, username).onSuccess { member ->
            profile = member
            member.id?.let { id ->
                launch {
                    api.accommodationOffer(session, id).onSuccess { hosting = it }.onFailure {
                        if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                    }
                    hostingLoaded = true
                }
                launch { api.contacts(session, id).onSuccess { contacts = it } }
                launch { api.references(session, id).onSuccess { references = it } }
                if (member.username != session.member.username) {
                    launch {
                        api.contactWith(session, id).onSuccess {
                            relationship = it
                            relationshipResolved = true
                        }.onFailure {
                            if ((it as? MobileApiException)?.isAuthenticationFailure == true) {
                                onSessionInvalidated()
                            } else {
                                relationshipResolved = true
                            }
                        }
                    }
                }
            }
        }.onFailure {
            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
            else error = it.message ?: "Could not load profile."
        }
    }
    val isSelf = profile?.username == session.member.username
    val showContactsTab = isSelf || contacts.isNotEmpty()
    Column(Modifier.fillMaxSize()) {
        when {
            profile == null && error == null -> CircularProgressIndicator(Modifier.padding(20.dp))
            error != null -> {
                TextButton(onClick = onBack) { Text("‹ Back") }
                Text(
                    requireNotNull(error),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(20.dp),
                )
            }
            else -> {
                val member = requireNotNull(profile)
                ProfileActionBar(
                    isSelf = isSelf,
                    onBack = onBack,
                    onEditProfile = { editing = true },
                    onMessage = {
                        recipient = MessageMember(member.id, member.username, member.displayName)
                    },
                    showShareExperience = referencesEnabled,
                    onShareExperience = { sharingExperience = true },
                    contactLabel = when {
                        !relationshipResolved -> null
                        relationship?.id.isNullOrBlank() -> "Add contact"
                        relationship?.confirmed == true -> "Remove contact"
                        else -> "Delete contact request"
                    },
                    onContactAction = {
                        val current = relationship
                        when {
                            current?.id.isNullOrBlank() -> {
                                member.id?.let { id ->
                                    browserRoute = BrowserRoute(
                                        title = "Add contact",
                                        url = "https://www.trustroots.org/contact-add/$id",
                                        sessionCookie = session.cookieHeader,
                                    )
                                }
                            }
                            else -> confirmRemoveContact = true
                        }
                    },
                )
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    Column(
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState()),
                    ) {
                        ArtworkHero(
                            url = member.id?.let { api.avatarURL(it, 512) },
                            sessionCookie = session.cookieHeader,
                            label = member.displayName,
                            subtitle = "@${member.username}",
                            background = MaterialTheme.colorScheme.primary,
                            blurBackground = true,
                            testTag = "profileHero",
                        )
                        Column(Modifier.padding(20.dp).padding(bottom = 8.dp)) {
                            when (section) {
                                ProfileSection.Overview -> ProfileOverviewSection(
                                    member = member,
                                    references = references,
                                    showAllReferences = showAllReferences,
                                    onToggleReferences = { showAllReferences = !showAllReferences },
                                    onOpenRelated = { relatedUsername = it },
                                    api = api,
                                    session = session,
                                )
                                ProfileSection.About -> ProfileAboutSection(member = member, api = api)
                                ProfileSection.Hosting -> ProfileHostingSection(
                                    hosting = hosting,
                                    hostingLoaded = hostingLoaded,
                                )
                                ProfileSection.Contacts -> ProfileContactsSection(
                                    contacts = contacts,
                                    showAllContacts = showAllContacts,
                                    onToggleContacts = { showAllContacts = !showAllContacts },
                                    onOpenRelated = { relatedUsername = it },
                                    api = api,
                                    session = session,
                                )
                            }
                        }
                    }
                }
                ProfileSectionBar(
                    selected = section,
                    showContacts = showContactsTab,
                    contactCount = contacts.size,
                    onSelect = { section = it },
                )
            }
        }
    }
}

private enum class ProfileSection(val label: String) {
    Overview("Overview"),
    About("About"),
    Hosting("Hosting"),
    Contacts("Contacts"),
}

@Composable
private fun ProfileActionBar(
    isSelf: Boolean,
    onBack: () -> Unit,
    onEditProfile: () -> Unit,
    onMessage: () -> Unit,
    showShareExperience: Boolean,
    onShareExperience: () -> Unit,
    contactLabel: String?,
    onContactAction: () -> Unit,
) {
    Surface(
        color = TrustrootsPaleGreen,
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth().testTag("profileActions"),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onBack) { Text("‹ Back") }
            if (isSelf) {
                TextButton(onClick = onEditProfile) { Text("Edit your profile") }
            } else {
                TextButton(onClick = onMessage) { Text("Send a message") }
                if (showShareExperience) {
                    TextButton(onClick = onShareExperience) { Text("Share your experience") }
                }
                contactLabel?.let { label ->
                    TextButton(onClick = onContactAction) { Text(label) }
                }
            }
        }
    }
}

@Composable
private fun ProfileSectionBar(
    selected: ProfileSection,
    showContacts: Boolean,
    contactCount: Int,
    onSelect: (ProfileSection) -> Unit,
) {
    val sections = buildList {
        add(ProfileSection.Overview)
        add(ProfileSection.About)
        add(ProfileSection.Hosting)
        if (showContacts) add(ProfileSection.Contacts)
    }
    Surface(
        color = TrustrootsPaleGreen,
        shadowElevation = 6.dp,
        modifier = Modifier.fillMaxWidth().testTag("profileSections"),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            sections.forEach { item ->
                val label = if (item == ProfileSection.Contacts && contactCount > 0) {
                    "${item.label} ($contactCount)"
                } else {
                    item.label
                }
                TextButton(
                    onClick = { onSelect(item) },
                    modifier = Modifier.testTag("profileSection-${item.name.lowercase()}"),
                ) {
                    Text(
                        label,
                        fontWeight = if (selected == item) FontWeight.Bold else FontWeight.Normal,
                        color = if (selected == item) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileOverviewSection(
    member: MemberProfile,
    references: List<ProfileReference>,
    showAllReferences: Boolean,
    onToggleReferences: () -> Unit,
    onOpenRelated: (String) -> Unit,
    api: MobileApiClient,
    session: MemberSession,
) {
    member.tagline?.let {
        Text(
            Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(),
            style = MaterialTheme.typography.titleMedium,
        )
    }
    member.location?.let { Text(it, modifier = Modifier.padding(top = 6.dp)) }
    if (references.isNotEmpty()) {
        Text("References", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
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
                Text(if (showAllReferences) "Show fewer" else "More references (${references.size - 6})")
            }
        }
    }
}

@Composable
private fun ProfileAboutSection(member: MemberProfile, api: MobileApiClient) {
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
private fun ProfileHostingSection(hosting: AccommodationOffer?, hostingLoaded: Boolean) {
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
private fun ProfileContactsSection(
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

@Composable
private fun EditProfileScreen(
    api: MobileApiClient,
    session: MemberSession,
    profile: MemberProfile,
    onSessionInvalidated: () -> Unit,
    onCancel: () -> Unit,
    onSaved: (MemberProfile) -> Unit,
) {
    var name by remember(profile.username) { mutableStateOf(profile.displayName) }
    var tagline by remember(profile.username) { mutableStateOf(profile.tagline.orEmpty()) }
    var description by remember(profile.username) {
        mutableStateOf(Html.fromHtml(profile.description.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim())
    }
    var living by remember(profile.username) { mutableStateOf(profile.locationLiving.orEmpty()) }
    var from by remember(profile.username) { mutableStateOf(profile.locationFrom.orEmpty()) }
    var languages by remember(profile.username) { mutableStateOf(profile.languages.toSet()) }
    var languageMenu by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val options = remember(languages) {
        (listOf("eng", "por", "spa", "fra", "deu", "ita", "nld", "rus", "ara", "zho", "hin", "jpn", "tur", "pol", "swe", "ukr") + languages)
            .distinct().sortedBy(::languageName)
    }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(20.dp)) {
        TextButton(onClick = onCancel) { Text("‹ Back") }
        Text("Edit profile", style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(tagline, { tagline = it }, label = { Text("Tagline") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(living, { living = it }, label = { Text("Lives in") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(from, { from = it }, label = { Text("From") }, modifier = Modifier.fillMaxWidth())
        Text("Languages", modifier = Modifier.padding(top = 12.dp))
        Box {
            TextButton(onClick = { languageMenu = true }) {
                Text(if (languages.isEmpty()) "Choose languages" else languages.sortedBy(::languageName).joinToString { languageName(it) })
            }
            DropdownMenu(expanded = languageMenu, onDismissRequest = { languageMenu = false }) {
                options.forEach { code ->
                    DropdownMenuItem(
                        text = { Text("${if (code in languages) "✓ " else ""}${languageName(code)}") },
                        onClick = { languages = if (code in languages) languages - code else languages + code },
                    )
                }
            }
        }
        OutlinedTextField(
            description, { description = it }, label = { Text("About me") },
            minLines = 5, maxLines = 12, modifier = Modifier.fillMaxWidth(),
        )
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(
            onClick = {
                scope.launch {
                    saving = true
                    error = null
                    api.updateProfile(session, ProfileUpdate(name, tagline, description, living, from, languages.toList()))
                        .onSuccess(onSaved)
                        .onFailure {
                            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                            else error = it.message ?: "Could not save profile."
                        }
                    saving = false
                }
            },
            enabled = name.isNotBlank() && !saving,
            modifier = Modifier.padding(top = 16.dp),
        ) { Text(if (saving) "Saving…" else "Save profile") }
    }
}

internal fun languageName(code: String): String {
    val names = mapOf(
        "eng" to "English", "ger" to "German", "deu" to "German", "fre" to "French",
        "fra" to "French", "spa" to "Spanish", "por" to "Portuguese", "ita" to "Italian",
        "dut" to "Dutch", "nld" to "Dutch", "rus" to "Russian", "cat" to "Catalan",
        "gsw" to "Swiss German", "swe" to "Swedish", "nor" to "Norwegian", "dan" to "Danish",
        "fin" to "Finnish", "pol" to "Polish", "ces" to "Czech", "cze" to "Czech",
        "ukr" to "Ukrainian", "tur" to "Turkish", "ara" to "Arabic", "rum" to "Romanian",
        "ron" to "Romanian", "jpn" to "Japanese", "kor" to "Korean", "zho" to "Chinese",
        "chi" to "Chinese", "hin" to "Hindi", "heb" to "Hebrew", "ell" to "Greek",
        "gre" to "Greek",
    )
    val normalised = code.lowercase(Locale.ROOT)
    val display = Locale.forLanguageTag(normalised).getDisplayLanguage(Locale.ENGLISH)
    return names[normalised] ?: display.takeIf { it.isNotBlank() && !it.equals(normalised, true) }
        ?: code.uppercase(Locale.ROOT)
}

@Composable
internal fun MessageInboxScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    initialMemberID: String? = null,
) {
    var threads by remember { mutableStateOf<List<MessageThread>>(emptyList()) }
    var selected by remember { mutableStateOf<MessageMember?>(null) }
    var selectedProfile by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }
    selectedProfile?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated) { selectedProfile = null }
        return
    }
    selected?.let { member ->
        ConversationScreen(
            api, session, member, onSessionInvalidated,
            onBack = { selected = null; reload++ },
            onOpenProfile = member.username?.let { username -> { selectedProfile = username } },
        )
        return
    }
    LaunchedEffect(reload) {
        loading = true
        error = null
        val collected = mutableListOf<MessageThread>()
        var page = 1
        do {
            val batch = api.inbox(session, page).getOrElse {
                if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                else if (collected.isEmpty()) error = it.message ?: "Could not load messages."
                break
            }
            collected += batch
            threads = collected.distinctBy { it.id }
            if (initialMemberID != null && selected == null) {
                selected = threads.firstOrNull { it.otherMember.id == initialMemberID }?.otherMember
            }
            page++
        } while (batch.size == 50)
        loaded = true
        loading = false
    }
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Messages", style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(filter, { filter = it }, label = { Text("Filter conversations") }, modifier = Modifier.fillMaxWidth())
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (loaded && threads.isEmpty() && error == null) Text("No conversations yet.")
        Column(Modifier.verticalScroll(rememberScrollState())) {
            threads.filter {
                val text = "${it.otherMember.label} ${it.otherMember.username.orEmpty()} ${it.excerpt}"
                text.contains(filter.trim(), ignoreCase = true)
            }.forEach { thread ->
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                    Column(Modifier.weight(1f).clickable { selected = thread.otherMember }) {
                        Row {
                            RemoteArtwork(
                                url = thread.otherMember.id?.let { api.avatarURL(it, 64) },
                                sessionCookie = session.cookieHeader,
                                label = thread.otherMember.label,
                                size = 44.dp,
                            )
                            Column(Modifier.padding(start = 10.dp)) {
                                Text(thread.otherMember.label, fontWeight = if (thread.read) FontWeight.Normal else FontWeight.Bold)
                                Text(thread.excerpt, maxLines = 2)
                            }
                        }
                    }
                    thread.otherMember.username?.let { username ->
                        TextButton(onClick = { selectedProfile = username }) { Text("Profile") }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
internal fun ConversationScreen(
    api: MobileApiClient,
    session: MemberSession,
    member: MessageMember,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onOpenProfile: (() -> Unit)? = null,
) {
    BackHandler(onBack = onBack)
    val context = LocalContext.current
    val drafts = remember { MessageDraftStore(context) }
    val draftKey = member.username ?: member.id.orEmpty()
    var messages by remember(member.id) { mutableStateOf<List<DirectMessage>>(emptyList()) }
    var draft by remember(member.id) {
        mutableStateOf(drafts.load(session.member.username, draftKey))
    }
    var error by remember(member.id) { mutableStateOf<String?>(null) }
    var sending by remember { mutableStateOf(false) }
    var messagesLoaded by remember(member.id) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val composerFocus = remember { FocusRequester() }
    val userHasReplied = messages.any { it.sender.username == session.member.username }
    val showQuickReply = messagesLoaded && messages.isNotEmpty() && !userHasReplied
    val updateDraft: (String) -> Unit = { text ->
        draft = text
        drafts.save(session.member.username, draftKey, text)
    }
    val sendContent: (String) -> Unit = sendContent@{ content ->
        val id = member.id ?: return@sendContent
        val trimmed = content.trim()
        if (trimmed.isBlank() || sending) return@sendContent
        scope.launch {
            sending = true
            api.sendMessage(session, id, content).onSuccess {
                messages = listOf(it) + messages
                draft = ""
                drafts.clear(session.member.username, draftKey)
                error = null
            }.onFailure {
                if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                else error = it.message ?: "Could not send message."
            }
            sending = false
        }
    }
    val send: () -> Unit = { sendContent(draft) }
    LaunchedEffect(member.id) {
        val id = member.id ?: return@LaunchedEffect
        api.conversation(session, id).onSuccess {
            messages = it
            messagesLoaded = true
        }.onFailure {
            messagesLoaded = true
            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
            else error = it.message ?: "Could not load conversation."
        }
    }
    Column(Modifier.fillMaxSize().imePadding().padding(20.dp)) {
        TextButton(onClick = onBack, modifier = Modifier.height(32.dp), contentPadding = PaddingValues(horizontal = 4.dp)) {
            Text("‹ Back")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            RemoteArtwork(
                url = member.id?.let { api.avatarURL(it, 96) },
                sessionCookie = session.cookieHeader,
                label = member.label,
                size = 52.dp,
            )
            Column(Modifier.padding(start = 12.dp)) {
                Text(member.label, style = MaterialTheme.typography.headlineMedium)
                if (onOpenProfile != null) {
                    TextButton(onClick = onOpenProfile) { Text("View profile") }
                }
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            messages.asReversed().forEach { message ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.sender.username == session.member.username) Arrangement.End else Arrangement.Start) {
                    if (message.sender.username != session.member.username) {
                        RemoteArtwork(
                            url = member.id?.let { api.avatarURL(it, 64) },
                            sessionCookie = session.cookieHeader,
                            label = member.label,
                            size = 30.dp,
                        )
                    }
                    Column(Modifier.padding(start = 6.dp, top = 8.dp, bottom = 8.dp)) {
                        Text(Html.fromHtml(message.content, Html.FROM_HTML_MODE_COMPACT).toString().trim())
                        message.createdAt?.let { created ->
                            Text(
                                messageTime(created),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
        if (showQuickReply) {
            QuickReplyBar(
                onHostYes = {
                    sendContent(
                        """<p data-hosting="yes"><b><i>Yes, I can host!</i></b></p>""",
                    )
                },
                onHostNo = {
                    sendContent(
                        """<p data-hosting="no"><b><i>Sorry I can't host</i></b></p>""",
                    )
                },
                onWriteBack = { composerFocus.requestFocus() },
                enabled = !sending && member.id != null,
            )
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            draft,
            updateDraft,
            label = { Text("Message") },
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(composerFocus)
                .testTag("messageComposer"),
            minLines = 2,
            maxLines = 8,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
        )
        Button(onClick = send, enabled = member.id != null && draft.isNotBlank() && !sending) {
            Text("Send")
        }
    }
}

@Composable
private fun QuickReplyBar(
    onHostYes: () -> Unit,
    onHostNo: () -> Unit,
    onWriteBack: () -> Unit,
    enabled: Boolean,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .testTag("quickReply"),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Button(onClick = onHostYes, enabled = enabled) { Text("Yes, I can host!") }
        Button(onClick = onHostNo, enabled = enabled) { Text("Sorry I can't host") }
        TextButton(onClick = onWriteBack, enabled = enabled) { Text("Write back") }
    }
}

@Composable
internal fun ContactsScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
) {
    var contacts by remember { mutableStateOf<List<ProfileContact>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedUsername by remember { mutableStateOf<String?>(null) }
    selectedUsername?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated) { selectedUsername = null }
        return
    }
    LaunchedEffect(session.member.username) {
        loading = true
        error = null
        api.profile(session, session.member.username).onSuccess { member ->
            val memberID = member.id
            if (memberID == null) {
                error = "Could not load contacts."
                loading = false
                return@onSuccess
            }
            api.contacts(session, memberID).onSuccess {
                contacts = it
                loading = false
            }.onFailure {
                if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                else {
                    error = it.message ?: "Could not load contacts."
                    loading = false
                }
            }
        }.onFailure {
            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
            else {
                error = it.message ?: "Could not load contacts."
                loading = false
            }
        }
    }
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Text("Contacts", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        when {
            loading -> CircularProgressIndicator(modifier = Modifier.padding(top = 20.dp))
            error != null -> Text(
                requireNotNull(error),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 16.dp),
            )
            contacts.isEmpty() -> Text(
                "People you connect with on Trustroots will appear here.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 16.dp),
            )
            else -> Column(Modifier.verticalScroll(rememberScrollState()).padding(top = 12.dp)) {
                contacts.forEach { contact ->
                    val username = contact.user.username
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (username != null) Modifier.clickable { selectedUsername = username }
                                else Modifier,
                            )
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RemoteArtwork(
                            url = contact.user.id?.let { api.avatarURL(it, 64) },
                            sessionCookie = session.cookieHeader,
                            label = contact.user.displayName,
                            size = 54.dp,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(contact.user.displayName, fontWeight = FontWeight.Bold)
                            username?.let { Text("@$it") }
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

internal fun messageTime(createdAt: Long, now: Long = System.currentTimeMillis()): String {
    val elapsed = (now - createdAt).coerceAtLeast(0)
    val minute = 60_000L
    val hour = 60 * minute
    val day = 24 * hour
    return when {
        elapsed < minute -> "Just now"
        elapsed < hour -> "${elapsed / minute} min ago"
        elapsed < day -> "${elapsed / hour} hr ago"
        elapsed < 7 * day -> "${elapsed / day} days ago"
        else -> SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(createdAt))
    }
}
