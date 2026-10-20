package org.trustroots.android.ui.profile

import android.text.Html
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.R
import org.trustroots.android.api.AccommodationOffer
import org.trustroots.android.api.ContactRelationship
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ProfileContact
import org.trustroots.android.api.ProfileReference
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.DefaultBrowserContent
import org.trustroots.android.ui.CreateExperienceScreen
import org.trustroots.android.ui.common.ArtworkBitmapState
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.rememberArtworkBitmapState
import org.trustroots.android.ui.conversation.ConversationScreen
import org.trustroots.android.ui.editprofile.EditProfileScreen

@Composable
internal fun MemberProfileScreen(
    api: MobileApiClient,
    session: MemberSession,
    username: String,
    onSessionInvalidated: () -> Unit,
    onOwnProfileSaved: (MemberProfile) -> Unit = {},
    startInEditMode: Boolean = false,
    contentPadding: PaddingValues = PaddingValues.Zero,
    onBack: () -> Unit,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = DefaultBrowserContent,
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
    val profilePager = rememberPagerState { ProfileSection.entries.size }
    var browserRoute by remember(username) { mutableStateOf<BrowserRoute?>(null) }
    var relationship by remember(username) { mutableStateOf<ContactRelationship?>(null) }
    var relationshipResolved by remember(username) { mutableStateOf(false) }
    var confirmRemoveContact by remember(username) { mutableStateOf(false) }
    var removingContact by remember(username) { mutableStateOf(false) }
    var sharingExperience by remember(username) { mutableStateOf(false) }
    var profileActionsHeight by remember(username) { mutableStateOf(0.dp) }
    var profileSectionBarHeight by remember(username) { mutableStateOf(48.dp) }
    val density = LocalDensity.current
    var showingProfileImage by remember(username) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val profileImageState = rememberArtworkBitmapState(
        url = if (showingProfileImage) profile?.id?.let { api.avatarURL(it, 2048) } else null,
        sessionCookie = if (showingProfileImage) session.cookieHeader else null,
        maxDownloadBytes = 8 * 1024 * 1024,
    )
    BackHandler {
        when {
            showingProfileImage -> showingProfileImage = false
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
            contentPadding = contentPadding,
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
            contentPadding = contentPadding,
        )
        return
    }
    relatedUsername?.let { related ->
        MemberProfileScreen(
            api, session, related, onSessionInvalidated,
            onBack = { relatedUsername = null },
            contentPadding = contentPadding,
            browserContent = browserContent,
        )
        return
    }
    recipient?.let {
        ConversationScreen(api, session, it, onSessionInvalidated, onBack = { recipient = null }, contentPadding = contentPadding)
        return
    }
    browserRoute?.let { route ->
        browserContent(route, { browserRoute = null }, contentPadding)
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
                                if (it.isAuthenticationFailure()) {
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
                        if (it.isAuthenticationFailure()) onSessionInvalidated()
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
                            if (it.isAuthenticationFailure()) {
                                onSessionInvalidated()
                            } else {
                                relationshipResolved = true
                            }
                        }
                    }
                }
            }
        }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr("Could not load profile.")
        }
    }
    val isSelf = profile?.username == session.member.username
    Column(Modifier.fillMaxSize()) {
        when {
            profile == null && error == null -> CircularProgressIndicator(Modifier.padding(20.dp))
            error != null -> {
                NativeBackButton(onBack)
                Text(
                    requireNotNull(error),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(20.dp),
                )
            }
            else -> {
                val member = requireNotNull(profile)
                BoxWithConstraints(Modifier.fillMaxSize()) {
                    val compactHeader = maxHeight < 560.dp
                    val sectionContentTarget = if (maxHeight >= 360.dp) 96.dp else 48.dp
                    val compactHeaderMinimum = 52.dp + profileSectionBarHeight
                    val heroHeight = if (compactHeader) {
                        val availableHeroHeight = maxHeight - profileActionsHeight -
                            contentPadding.calculateBottomPadding() - sectionContentTarget
                        availableHeroHeight.coerceAtLeast(compactHeaderMinimum).coerceAtMost(250.dp.coerceAtLeast(compactHeaderMinimum))
                    } else 250.dp
                    Column(Modifier.fillMaxSize()) {
                        Box(
                            Modifier.fillMaxWidth().onSizeChanged { size ->
                                val measuredHeight = with(density) { size.height.toDp() }
                                if (profileActionsHeight != measuredHeight) profileActionsHeight = measuredHeight
                            },
                        ) {
                            ProfileActionBar(
                                isSelf = isSelf,
                                onBack = onBack,
                                onEditProfile = { editing = true },
                                onMessage = {
                                    recipient = MessageMember(member.id, member.username, member.displayName)
                                },
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
                                topPadding = contentPadding.calculateTopPadding(),
                                horizontalInset = contentPadding.horizontalInset(),
                            )
                        }
                        ArtworkHero(
                            url = member.id?.let { api.avatarURL(it, 512) },
                            sessionCookie = session.cookieHeader,
                            label = member.displayName,
                            subtitle = "@${member.username}",
                            background = MaterialTheme.colorScheme.primary,
                            blurBackground = true,
                            testTag = "profileHero",
                            heroHeight = heroHeight,
                            compact = compactHeader,
                            bottomContent = {
                                Box(
                                    Modifier.fillMaxWidth().onSizeChanged { size ->
                                        val measuredHeight = with(density) { size.height.toDp() }
                                        if (profileSectionBarHeight != measuredHeight) profileSectionBarHeight = measuredHeight
                                    },
                                ) {
                                    ProfileSectionBar(
                                        selected = ProfileSection.entries[profilePager.currentPage],
                                        contactCount = contacts.size,
                                        onSelect = { section -> scope.launch { profilePager.animateScrollToPage(section.ordinal) } },
                                        overArtwork = true,
                                    )
                                }
                            },
                            onProfileImageClick = if (member.id != null) {
                                { showingProfileImage = true }
                            } else {
                                null
                            },
                        )
                        HorizontalPager(state = profilePager, modifier = Modifier.weight(1f).fillMaxWidth().testTag("profilePager")) { page ->
                            Column(Modifier.fillMaxSize().padding(bottom = contentPadding.calculateBottomPadding()).verticalScroll(rememberScrollState())) {
                                Column(Modifier.padding(20.dp).padding(contentPadding.horizontalInset())) {
                                    when (ProfileSection.entries[page]) {
                                        ProfileSection.About -> {
                                            member.tagline?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), style = MaterialTheme.typography.titleMedium) }
                                            member.location?.let { Text(it, modifier = Modifier.padding(vertical = 6.dp)) }
                                            ProfileAboutSection(member = member, api = api)
                                            HorizontalDivider(Modifier.padding(vertical = 16.dp))
                                            ProfileHostingSection(hosting = hosting, hostingLoaded = hostingLoaded)
                                        }
                                        ProfileSection.Experiences -> ProfileOverviewSection(
                                            references = references,
                                            showAllReferences = showAllReferences,
                                            onToggleReferences = { showAllReferences = !showAllReferences },
                                            onOpenRelated = { relatedUsername = it },
                                            api = api,
                                            session = session,
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
                    }
                }
            }
        }
    }
    if (showingProfileImage) {
        ProfileImageViewer(
            bitmap = (profileImageState as? ArtworkBitmapState.Loaded)?.bitmap,
            isLoading = profileImageState is ArtworkBitmapState.Loading,
            memberLabel = profile?.displayName ?: stringResource(R.string.profile_photo_default_member_label),
            onClose = { showingProfileImage = false },
        )
    }
}
