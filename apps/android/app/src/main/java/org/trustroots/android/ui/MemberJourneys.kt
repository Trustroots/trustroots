package org.trustroots.android.ui

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.ImeAction
import android.text.Html
import kotlinx.coroutines.launch
import org.trustroots.android.api.DirectMessage
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.api.ProfileUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import java.util.Locale
import java.text.SimpleDateFormat
import java.util.Date

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
    var editing by remember(username) { mutableStateOf(false) }
    if (editing && profile != null) {
        EditProfileScreen(
            api, session, requireNotNull(profile), onSessionInvalidated,
            onCancel = { editing = false },
            onSaved = { updated -> profile = updated; editing = false; onOwnProfileSaved(updated) },
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
            }
        }.onFailure {
            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
            else error = it.message ?: "Could not load profile."
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        if (profile == null && error == null) CircularProgressIndicator(Modifier.padding(20.dp))
        error?.let {
            TextButton(onClick = onBack) { Text("‹ Back") }
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(20.dp))
        }
        profile?.let { member ->
            Box {
            ArtworkHero(
                url = member.id?.let { api.avatarURL(it, 512) },
                sessionCookie = session.cookieHeader,
                label = member.displayName,
                subtitle = "@${member.username}",
                background = MaterialTheme.colorScheme.primary,
                blurBackground = true,
                testTag = "profileHero",
            )
            TextButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart).padding(8.dp)) {
                Text("‹ Back", color = Color.White)
            }
            }
            Column(Modifier.padding(20.dp)) {
            if (member.username == session.member.username) {
                Button(onClick = { editing = true }) { Text("Edit profile") }
            }
            member.tagline?.let {
                Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), style = MaterialTheme.typography.titleMedium)
            }
            member.location?.let { Text(it) }
            member.description?.let {
                Text(
                    Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(),
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
            if (member.languages.isNotEmpty()) {
                Text("Languages: ${member.languages.joinToString { languageName(it) }}")
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
            if (hostingLoaded) {
                Text("Hosting", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
                val status = when (hosting?.status) {
                    "yes" -> "Hosting travellers"
                    "maybe" -> "Maybe hosting"
                    else -> "Not hosting currently"
                }
                Text(status, fontWeight = FontWeight.Bold)
                hosting?.let { offer ->
                    val details = if (offer.status == "yes" || offer.status == "maybe") {
                        offer.description
                    } else offer.noOfferDescription
                    details?.let {
                        Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim())
                    }
                    if (offer.status == "yes" || offer.status == "maybe") {
                        offer.maxGuests?.let { Text(if (it == 1) "Space for 1 guest" else "Space for up to $it guests") }
                    }
                }
            }
            if (member.username != session.member.username && member.id != null) {
                Button(onClick = {
                    recipient = MessageMember(member.id, member.username, member.displayName)
                }) { Text("Message") }
            }
            if (contacts.isNotEmpty()) {
                Text("Contacts", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
                (if (showAllContacts) contacts else contacts.take(6)).forEach { contact ->
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            contact.user.username?.let { relatedUsername = it }
                        }.padding(vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RemoteArtwork(contact.user.id?.let { api.avatarURL(it, 64) }, session.cookieHeader, contact.user.label, 36.dp)
                        Text(contact.user.label, modifier = Modifier.padding(start = 10.dp))
                    }
                }
                if (contacts.size > 6) TextButton(onClick = { showAllContacts = !showAllContacts }) {
                    Text(if (showAllContacts) "Show fewer" else "More contacts (${contacts.size - 6})")
                }
            }
            if (references.isNotEmpty()) {
                Text("References", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 18.dp))
                (if (showAllReferences) references else references.take(6)).forEach { reference ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RemoteArtwork(reference.author.id?.let { api.avatarURL(it, 64) }, session.cookieHeader, reference.author.label, 36.dp)
                            TextButton(onClick = { reference.author.username?.let { relatedUsername = it } }) {
                                Text(reference.author.label)
                            }
                        }
                        reference.feedback?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim()) }
                        reference.response?.let { Text("Response: ${Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim()}") }
                    }
                }
                if (references.size > 6) TextButton(onClick = { showAllReferences = !showAllReferences }) {
                    Text(if (showAllReferences) "Show fewer" else "More references (${references.size - 6})")
                }
            }
            }
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
    var messages by remember(member.id) { mutableStateOf<List<DirectMessage>>(emptyList()) }
    var draft by remember(member.id) { mutableStateOf("") }
    var error by remember(member.id) { mutableStateOf<String?>(null) }
    var sending by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val send: () -> Unit = send@{
        val id = member.id ?: return@send
        if (draft.isBlank() || sending) return@send
        scope.launch {
            sending = true
            api.sendMessage(session, id, draft).onSuccess {
                messages = listOf(it) + messages
                draft = ""
                error = null
            }.onFailure {
                if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                else error = it.message ?: "Could not send message."
            }
            sending = false
        }
    }
    LaunchedEffect(member.id) {
        val id = member.id ?: return@LaunchedEffect
        api.conversation(session, id).onSuccess { messages = it }.onFailure {
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
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            draft, { draft = it },
            label = { Text("Message") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { send() }),
        )
        Button(onClick = send, enabled = member.id != null && draft.isNotBlank() && !sending) {
            Text("Send")
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
