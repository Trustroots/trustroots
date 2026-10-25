package org.trustroots.android.ui.profile

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.text.Html
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.input.nestedscroll.nestedScroll
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.launch
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import org.trustroots.android.R
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.DefaultBrowserContent
import org.trustroots.android.ui.experience.CreateExperienceScreen
import org.trustroots.android.ui.common.ArtworkBitmapState
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.rememberSnappableCollapseHeader
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.common.rememberArtworkBitmapState
import org.trustroots.android.ui.common.memberLocationLabel
import org.trustroots.android.ui.conversation.MessageConversationEntryScreen
import org.trustroots.android.ui.editprofile.EditProfileScreen
import org.trustroots.android.ui.circles.CircleDetailVisit
import org.trustroots.android.ui.circledetail.CircleDetailEntry

@Composable
internal fun MemberProfileScreen(
    api: MobileApiClient,
    session: MemberSession,
    username: String,
    onSessionInvalidated: () -> Unit,
    onOwnProfileSaved: (MemberProfile) -> Unit = {},
    contentPadding: PaddingValues = PaddingValues.Zero,
    onBack: () -> Unit,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = DefaultBrowserContent,
) {
    val initialVisit = remember(username) { MemberProfileVisit(username, 0L) }
    val backStack = rememberNavBackStack(initialVisit)
    var nextVisitID by rememberSaveable(username) { mutableStateOf(1L) }
    val handoffViewModel = rememberProfileFlowHandoffViewModel(api, session)
    val storedHandoffs by handoffViewModel.handoffs.collectAsState()
    val activeHandoffEnvironment by handoffViewModel.runtimeEnvironment.collectAsState()
    val handoffEnvironment = ProfileFlowEnvironment(api.backendURL, session.member.username, session.cookieHeader)
    val handoffs = if (activeHandoffEnvironment == handoffEnvironment) storedHandoffs else emptyMap()
    val popProfile: () -> Unit = {
        if (backStack.size > 1) {
            val removed = backStack.lastOrNull()
            if (removed is MemberProfileVisit) {
                handoffViewModel.removeProfileVisit(removed.visitID)
            }
            backStack.removeLastOrNull()
        } else onBack()
    }
    val leaveGuardState = LocalLeaveGuard.current
    val popProfileFromNavigation: () -> Unit = {
        val leave = popProfile
        leaveGuardState?.value?.invoke(leave) ?: leave()
    }
    val pushRelated: (String) -> Unit = { related -> backStack.add(MemberProfileVisit(related, nextVisitID++)) }
    val pushConversation: (String) -> Unit = { memberID ->
        backStack.add(ProfileConversationVisit(memberID, nextVisitID++))
    }
    val pushContactBrowser: (String) -> Unit = { memberID ->
        backStack.add(ProfileBrowserVisit(ProfileBrowserDestination.ContactRequest, memberID, nextVisitID++))
    }
    val decorators: List<NavEntryDecorator<NavKey>> = listOf(
        rememberSaveableStateHolderNavEntryDecorator(),
        rememberViewModelStoreNavEntryDecorator(),
    )
    NavDisplay(
        backStack = backStack,
        onBack = popProfileFromNavigation,
        entryDecorators = decorators,
        entryProvider = entryProvider {
            entry<MemberProfileVisit> { route ->
                val isActiveRoute = remember(backStack, route) {
                    derivedStateOf { backStack.lastOrNull() == route }
                }
                val model = rememberMemberProfileViewModel(api, session, route.username)
                MemberProfileContent(
                    api = api, session = session, username = route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    contentPadding = contentPadding, onBack = popProfileFromNavigation,
                    viewModel = model, onOpenRelated = pushRelated,
                    onOpenConversation = pushConversation,
                    onOpenContactBrowser = pushContactBrowser,
                    onOpenCircle = { slug -> backStack.add(CircleDetailVisit(slug, nextVisitID++)) },
                    isActiveProfileRoute = isActiveRoute.value,
                    onOpenEditProfile = { backStack.add(MemberProfileEditVisit(route.username, route.visitID, nextVisitID++)) },
                    onOpenExperience = { memberID -> backStack.add(MemberProfileExperienceVisit(route.username, memberID, route.visitID, nextVisitID++)) },
                    onDisplayNameChanged = { handoffViewModel.retainDisplayName(route.visitID, it, handoffEnvironment) },
                    onProfileChanged = { handoffViewModel.retainProfile(route.visitID, it, handoffEnvironment) },
                    completion = handoffs[route.visitID]?.completion,
                    onCompletionHandled = { deliveryID -> handoffViewModel.consumeCompletion(route.visitID, deliveryID) },
                )
            }
            entry<CircleDetailVisit> { route ->
                CircleDetailEntry(
                    slug = route.slug, api = api, session = session,
                    onSessionInvalidated = onSessionInvalidated,
                    contentPadding = contentPadding, onBack = popProfile,
                    onMembershipChanged = { _, _ -> },
                )
            }
            entry<MemberProfileEditVisit> { route ->
                EditProfileScreen(
                    api = api,
                    session = session,
                    profile = handoffs[route.parentVisitID]?.profileSnapshot,
                    username = route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    onCancel = popProfile,
                    onSaved = { updated ->
                        handoffViewModel.completeProfileSaved(route.parentVisitID, updated, handoffEnvironment)
                        onOwnProfileSaved(updated)
                        popProfile()
                    },
                    contentPadding = contentPadding,
                )
            }
            entry<MemberProfileExperienceVisit> { route ->
                CreateExperienceScreen(
                    api = api,
                    session = session,
                    memberID = route.memberID,
                    memberLabel = handoffs[route.parentVisitID]?.displayName ?: route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    onBack = popProfile,
                    onCreated = {
                        handoffViewModel.completeExperienceCreated(route.parentVisitID, handoffEnvironment)
                        popProfile()
                    },
                    contentPadding = contentPadding,
                )
            }
            entry<ProfileConversationVisit> { route ->
                MessageConversationEntryScreen(
                    memberID = route.memberID,
                    api = api,
                    session = session,
                    onSessionInvalidated = onSessionInvalidated,
                    onBack = popProfileFromNavigation,
                    onOpenProfile = pushRelated,
                    contentPadding = contentPadding,
                )
            }
            entry<ProfileBrowserVisit> { route ->
                val browserRoute = when (route.destination) {
                    ProfileBrowserDestination.ContactRequest -> BrowserRoute(
                        title = stringResource(R.string.profile_add_contact),
                        url = "https://www.trustroots.org/contact-add/${route.memberID}",
                        sessionCookie = session.cookieHeader,
                    )
                }
                browserContent(browserRoute, popProfileFromNavigation, contentPadding)
            }
        },
    )
}

@Composable
private fun MemberProfileContent(
    api: MobileApiClient,
    session: MemberSession,
    username: String,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    viewModel: MemberProfileViewModel,
    onOpenRelated: (String) -> Unit,
    onOpenConversation: (String) -> Unit,
    onOpenContactBrowser: (String) -> Unit,
    onOpenCircle: (String) -> Unit,
    isActiveProfileRoute: Boolean,
    onOpenEditProfile: () -> Unit,
    onOpenExperience: (String) -> Unit,
    onDisplayNameChanged: (String) -> Unit,
    onProfileChanged: (MemberProfile) -> Unit,
    completion: ProfileFlowCompletion?,
    onCompletionHandled: (Long) -> ProfileFlowCompletion?,
) {
    SideEffect { viewModel.updateEnvironment(api, session) }
    val profileState by viewModel.state.collectAsState()
    val profile = profileState.profile
    val hosting = profileState.hosting
    val hostingLoaded = profileState.hostingLoaded
    val error = profileState.failure?.let {
        UiFailure(serverMessage = it.serverMessage, apiKind = it.apiKind, fallback = UiFailureFallback.LOAD_PROFILE)
    }
    val contacts = profileState.contacts
    val references = profileState.references
    var showAllContacts by rememberSaveable(username) { mutableStateOf(false) }
    var showAllReferences by rememberSaveable(username) { mutableStateOf(false) }
    val profilePager = rememberPagerState { ProfileSection.entries.size }
    val relationship = profileState.relationship
    val relationshipResolved = profileState.relationshipResolved
    var confirmRemoveContact by rememberSaveable(username) { mutableStateOf(false) }
    val removingContact = profileState.isRemovingContact
    var blockTarget by rememberSaveable(username, api.backendURL, session.member.username, session.cookieHeader) { mutableStateOf<Boolean?>(null) }
    var reportVisible by rememberSaveable(username, api.backendURL, session.member.username, session.cookieHeader) { mutableStateOf(false) }
    var profileActionsHeight by remember(username) { mutableStateOf(0.dp) }
    var profileSectionBarHeight by remember(username) { mutableStateOf(48.dp) }
    val density = LocalDensity.current
    var showingProfileImage by rememberSaveable(username) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val profileImageState = rememberArtworkBitmapState(
        url = if (showingProfileImage) profile?.id?.let { api.avatarURL(it, 2048) } else null,
        sessionCookie = if (showingProfileImage) session.cookieHeader else null,
        maxDownloadBytes = 8 * 1024 * 1024,
    )
    ProfileHeaderStatusBarStyle(
        enabled = isActiveProfileRoute && profile != null && error == null,
    )
    BackHandler(enabled = isActiveProfileRoute) {
        when {
            showingProfileImage -> showingProfileImage = false
            confirmRemoveContact -> if (!removingContact) confirmRemoveContact = false
            else -> onBack()
        }
    }
    LaunchedEffect(profileState.isBlocked, profileState.isUpdatingBlock, blockTarget) {
        if (blockTarget != null && !profileState.isUpdatingBlock && profileState.isBlocked == blockTarget) blockTarget = null
    }
    LaunchedEffect(isActiveProfileRoute) {
        if (isActiveProfileRoute && profileState.profile != null) viewModel.onEvent(MemberProfileEvent.RetryBlockStatus)
    }
    if (profile != null && !profile.username.equals(session.member.username, ignoreCase = true)) {
        blockTarget?.let { target ->
            ProfileBlockDialog(
                displayName = profile.displayName,
                blocked = target,
                state = profileState,
                onDismiss = { blockTarget = null },
                onConfirm = { viewModel.onEvent(MemberProfileEvent.SetBlocked(target)) },
            )
        }
        if (reportVisible) {
            ProfileReportDialog(
                displayName = profile.displayName,
                state = profileState,
                onDismiss = {
                    reportVisible = false
                    viewModel.onEvent(MemberProfileEvent.DismissReport)
                },
                onDraftChanged = { viewModel.onEvent(MemberProfileEvent.ReportDraftChanged(it)) },
                onSubmit = { viewModel.onEvent(MemberProfileEvent.SubmitReport) },
            )
        }
    }
    if (confirmRemoveContact) {
        val existing = relationship
        AlertDialog(
            onDismissRequest = {
                if (!removingContact) {
                    confirmRemoveContact = false
                    viewModel.onEvent(MemberProfileEvent.DismissRemoveContact)
                }
            },
            title = {
                Text(
                    stringResource(
                        if (existing?.confirmed == true) R.string.profile_remove_contact_confirm_title
                        else R.string.profile_delete_contact_request_confirm_title,
                    ),
                )
            },
            text = {
                Text(
                    if (existing?.confirmed == true) {
                        stringResource(R.string.profile_remove_contact_confirm_message)
                    } else {
                        stringResource(R.string.profile_delete_contact_request_confirm_message)
                    },
                )
            },
            confirmButton = {
                TextButton(
                    enabled = !removingContact && existing?.id != null,
                    onClick = {
                        if (existing?.id == null) return@TextButton
                        viewModel.onEvent(MemberProfileEvent.ConfirmRemoveContact)
                    },
                ) { Text(if (removingContact) stringResource(R.string.profile_removing_contact) else stringResource(R.string.profile_confirm)) }
            },
            dismissButton = {
                TextButton(enabled = !removingContact, onClick = {
                    confirmRemoveContact = false
                    viewModel.onEvent(MemberProfileEvent.DismissRemoveContact)
                }) {
                    Text(stringResource(R.string.profile_cancel))
                }
            },
        )
    }
    LaunchedEffect(profileState.pendingSessionInvalidation?.id) {
        profileState.pendingSessionInvalidation?.let { invalidation ->
            onSessionInvalidated()
            viewModel.onEvent(MemberProfileEvent.SessionInvalidationDelivered(invalidation.id))
        }
    }
    SideEffect {
        viewModel.updateEnvironment(api, session)
        viewModel.state.value.profile?.let {
            onDisplayNameChanged(it.displayName)
            onProfileChanged(it)
        }
    }
    LaunchedEffect(completion?.deliveryID) {
        val deliveryID = completion?.deliveryID ?: return@LaunchedEffect
        when (val pending = onCompletionHandled(deliveryID)) {
            is ProfileFlowCompletion.ProfileSaved -> viewModel.onEvent(MemberProfileEvent.ProfileSaved(pending.profile))
            is ProfileFlowCompletion.ExperienceCreated -> viewModel.onEvent(MemberProfileEvent.RefreshReferences)
            null -> Unit
        }
    }
    LaunchedEffect(profileState.contactRemovalSucceeded) {
        if (profileState.contactRemovalSucceeded) {
            confirmRemoveContact = false
            viewModel.onEvent(MemberProfileEvent.DismissRemoveContact)
        }
    }
    val isSelf = profile?.username?.equals(session.member.username, ignoreCase = true) == true
    Column(Modifier.fillMaxSize()) {
        when {
            profile == null && error == null -> CircularProgressIndicator(Modifier.padding(20.dp))
            error != null -> {
                NativeBackButton(onBack)
                Text(
                    resolveFailureMessage(requireNotNull(error)),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(20.dp),
                )
            }
            else -> {
                val member = requireNotNull(profile)
                BoxWithConstraints(Modifier.fillMaxSize()) {
                    val compactHeader = maxHeight < 560.dp
                    val sectionContentTarget = if (maxHeight >= 360.dp) 96.dp else 48.dp
                    val compactHeaderHeight = profileActionsHeight
                    val expandedHeaderHeight = if (compactHeader) {
                        (maxHeight - contentPadding.calculateBottomPadding() - sectionContentTarget)
                            .coerceAtLeast(compactHeaderHeight)
                            .coerceAtMost(profileActionsHeight + 250.dp)
                    } else profileActionsHeight + 250.dp
                    val collapsibleHeader = rememberSnappableCollapseHeader(
                        expandedHeaderHeight = { expandedHeaderHeight },
                        compactHeaderHeight = { compactHeaderHeight },
                        key = username,
                    )
                    val headerHeight = collapsibleHeader.headerHeight
                    val compactProfileHeader = collapsibleHeader.isCollapsed
                    val addContactLabel = stringResource(R.string.profile_add_contact)
                    Column(Modifier.fillMaxSize().nestedScroll(collapsibleHeader.connection)) {
                        Box(Modifier.fillMaxWidth().height(headerHeight).clipToBounds()) {
                            ArtworkHero(
                                url = member.id?.let { api.avatarURL(it, 512) },
                                sessionCookie = session.cookieHeader,
                                label = member.displayName,
                                subtitle = stringResource(R.string.screen_username_handle, member.username),
                                background = MaterialTheme.colorScheme.primary,
                                blurBackground = true,
                                testTag = "profileHero",
                                heroHeight = headerHeight,
                                compact = compactProfileHeader,
                                showCompactIdentity = false,
                                bottomContent = {
                                    if (!compactProfileHeader) {
                                        val tabOffset = (profileActionsHeight - (headerHeight - profileSectionBarHeight)).coerceAtLeast(0.dp)
                                        Box(
                                            Modifier.fillMaxWidth()
                                                .offset(y = tabOffset)
                                                .onSizeChanged { size ->
                                                    val measuredHeight = with(density) { size.height.toDp() }
                                                    if (profileSectionBarHeight != measuredHeight) profileSectionBarHeight = measuredHeight
                                                },
                                        ) {
                                            ProfileSectionBar(
                                                selected = ProfileSection.entries[profilePager.currentPage],
                                                contactCount = contacts.size,
                                                onSelect = { section -> scope.launch { profilePager.animateScrollToPage(section.ordinal) } },
                                            )
                                        }
                                    }
                                },
                                onProfileImageClick = if (member.id != null) {
                                    { showingProfileImage = true }
                                } else {
                                    null
                                },
                            )
                            Box(
                                Modifier.fillMaxWidth()
                                    .onSizeChanged { size ->
                                        val measuredHeight = with(density) { size.height.toDp() }
                                        if (profileActionsHeight != measuredHeight) profileActionsHeight = measuredHeight
                                    }
                                    .testTag("profileActionsScrim"),
                                contentAlignment = Alignment.TopStart,
                            ) {
                                ProfileActionBar(
                                    isSelf = isSelf,
                                    onBack = onBack,
                                    onEditProfile = onOpenEditProfile,
                                    onMessage = {
                                        if (profileState.isBlocked != true && !profileState.isUpdatingBlock) member.id?.let(onOpenConversation)
                                    },
                                    onShareExperience = { member.id?.let(onOpenExperience) },
                                    contactLabel = when {
                                        !relationshipResolved -> null
                                        relationship?.id.isNullOrBlank() -> addContactLabel
                                        relationship?.confirmed == true -> stringResource(R.string.profile_remove_contact)
                                        else -> stringResource(R.string.profile_delete_contact_request)
                                    },
                                onContactAction = {
                                        val current = relationship
                                        when {
                                            current?.id.isNullOrBlank() -> {
                                                member.id?.let { id ->
                                                    onOpenContactBrowser(id)
                                                }
                                            }
                                            else -> confirmRemoveContact = true
                                        }
                                    },
                                    topPadding = contentPadding.calculateTopPadding(),
                                    horizontalInset = contentPadding.horizontalInset(),
                                    compactTitle = member.displayName.takeIf { compactProfileHeader },
                                    isBlocked = profileState.isBlocked,
                                    safetyBusy = profileState.isUpdatingBlock || profileState.isLoadingBlock,
                                    onBlock = { profileState.isBlocked?.let { blockTarget = !it } },
                                    onReport = { reportVisible = true },
                                )
                            }
                        }
                        if (!isSelf) ProfileSafetyNotice(
                            displayName = member.displayName,
                            state = profileState,
                            onRetry = { viewModel.onEvent(MemberProfileEvent.RetryBlockStatus) },
                        )
                        HorizontalPager(state = profilePager, modifier = Modifier.weight(1f).fillMaxWidth().testTag("profilePager")) { page ->
                            Column(Modifier.fillMaxSize().padding(bottom = contentPadding.calculateBottomPadding()).verticalScroll(rememberScrollState())) {
                                Column(Modifier.padding(20.dp).padding(contentPadding.horizontalInset())) {
                                    when (ProfileSection.entries[page]) {
                                        ProfileSection.About -> {
                                            member.tagline?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), style = MaterialTheme.typography.titleMedium) }
                                            memberLocationLabel(member.locationLiving, member.locationFrom)?.let {
                                                Text(it, modifier = Modifier.padding(vertical = 6.dp))
                                            }
                                            ProfileAboutSection(member = member)
                                            HorizontalDivider(Modifier.padding(vertical = 16.dp))
                                            ProfileHostingSection(hosting = hosting, hostingLoaded = hostingLoaded)
                                            ProfileCirclesSection(member = member, api = api, onOpenCircle = onOpenCircle)
                                        }
                                        ProfileSection.Experiences -> ProfileOverviewSection(
                                            references = references,
                                            showAllReferences = showAllReferences,
                                            onToggleReferences = { showAllReferences = !showAllReferences },
                                            onOpenRelated = onOpenRelated,
                                            api = api,
                                            session = session,
                                        )
                                        ProfileSection.Contacts -> ProfileContactsSection(
                                            contacts = contacts,
                                            showAllContacts = showAllContacts,
                                            onToggleContacts = { showAllContacts = !showAllContacts },
                                            onOpenRelated = onOpenRelated,
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

@Composable
private fun ProfileHeaderStatusBarStyle(enabled: Boolean) {
    val view = LocalView.current
    val window = view.context.findActivity()?.window
    val darkAppearance = isSystemInDarkTheme()
    val latestDarkAppearance by rememberUpdatedState(darkAppearance)
    DisposableEffect(window, enabled) {
        if (window == null || !enabled) return@DisposableEffect onDispose {}
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        onDispose {
            controller.isAppearanceLightStatusBars = !latestDarkAppearance
        }
    }
}

private fun Context.findActivity(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return current as? Activity
}
