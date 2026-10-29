package org.trustroots.android.ui.circledetail

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import org.trustroots.android.R
import org.trustroots.android.api.CircleMemberGroups
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.circles.CirclesFailure
import org.trustroots.android.ui.circles.CirclesFailureKind
import org.trustroots.android.ui.circles.MobileApiCircleRepository
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.circles.circleColor
import org.trustroots.android.ui.circles.circleDescription
import org.trustroots.android.ui.circles.circlesFailureMessage
import org.trustroots.android.ui.common.bottomInset
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.rememberSnappableCollapseHeader

@Composable
internal fun CircleDetailEntry(
    slug: String,
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onMembershipChanged: (String, Boolean) -> Unit,
    onOpenProfile: (String) -> Unit,
) {
    val owner = requireNavigationViewModelStoreOwner("CircleDetailVisit must own its CircleDetailViewModel store")
    val factory = remember(owner, slug) {
        CircleDetailViewModel.Factory(slug, MobileApiCircleRepository(api, session))
    }
    val viewModel = rememberEntryViewModel(owner, CircleDetailViewModel::class.java, factory)
    SideEffect { viewModel.updateEnvironment(api, session) }
    val state by viewModel.state.collectAsState()
    LaunchedEffect(viewModel, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        viewModel.onEvent(CircleDetailEvent.SessionInvalidationDelivered(pending.id))
    }
    LaunchedEffect(viewModel, state.pendingOverviewMembershipEvent?.id) {
        val event = state.pendingOverviewMembershipEvent ?: return@LaunchedEffect
        onMembershipChanged(event.circleID, event.isMember)
        viewModel.onEvent(CircleDetailEvent.OverviewMembershipEventDelivered(event.id))
    }
    CircleDetailContent(
        slug = slug,
        circle = state.circle,
        session = session,
        memberGroups = state.memberGroups,
        isLoadingMembers = state.isLoadingMembers,
        api = api,
        membershipsLoaded = state.membershipsLoaded,
        isMember = state.isMember,
        isLoading = state.isLoading,
        isUpdating = state.isUpdating,
        failure = state.failure,
        canRetryLoad = state.canRetryLoad,
        onRetry = { viewModel.onEvent(CircleDetailEvent.RetryLoad) },
        contentPadding = contentPadding,
        onBack = onBack,
        onToggleMembership = { viewModel.onEvent(CircleDetailEvent.ToggleMembership) },
        onOpenProfile = onOpenProfile,
    )
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
internal fun CircleDetailContent(
    slug: String,
    circle: TrustrootsCircle?,
    session: MemberSession,
    memberGroups: CircleMemberGroups?,
    isLoadingMembers: Boolean,
    api: MobileApiClient,
    membershipsLoaded: Boolean,
    isMember: Boolean,
    isLoading: Boolean,
    isUpdating: Boolean,
    failure: CirclesFailure?,
    canRetryLoad: Boolean,
    onRetry: () -> Unit,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onToggleMembership: () -> Unit,
    onOpenProfile: (String) -> Unit,
) {
    val failureMessage = circlesFailureMessage(failure)
    val topPadding = contentPadding.calculateTopPadding()
    val compactHeaderHeight = 64.dp
    val collapsibleHeader = rememberSnappableCollapseHeader(
        expandedHeaderHeight = { topPadding + compactHeaderHeight + 250.dp },
        compactHeaderHeight = { topPadding + compactHeaderHeight },
    )
    Scaffold(
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
    ) { scaffoldPadding ->
        Column(
            Modifier.fillMaxSize()
                .padding(scaffoldPadding)
                .nestedScroll(collapsibleHeader.connection),
        ) {
            if (circle == null) {
                Column(
                    Modifier.fillMaxWidth().weight(1f).testTag("circlesList")
                        .padding(top = topPadding).padding(20.dp)
                        .padding(contentPadding.horizontalInset())
                        .padding(contentPadding.bottomInset()),
                ) {
                    NativeBackButton(onBack)
                    if (isLoading) CircularProgressIndicator()
                    failureMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    if (canRetryLoad) Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                }
            } else {
                val collapsed = collapsibleHeader.isCollapsed
                Box(
                    Modifier.fillMaxWidth().height(collapsibleHeader.headerHeight).clipToBounds(),
                ) {
                    if (collapsed) {
                        PinnedTopAppBar(
                            title = circle.label,
                            scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(),
                            contentPadding = contentPadding,
                            onBack = onBack,
                        )
                    } else {
                        ArtworkHero(
                            url = if (circle.image) api.circleHeroURL(circle.slug) else null,
                            sessionCookie = null,
                            label = circle.label,
                            subtitle = pluralStringResource(R.plurals.screen_circle_member_count, circle.count, circle.count),
                            background = circleColor(circle.color, MaterialTheme.colorScheme.secondary),
                            blurBackground = false,
                            testTag = "circleHero",
                            showTitle = true,
                            heroHeight = collapsibleHeader.headerHeight,
                            compact = false,
                        )
                        val backButton: @Composable () -> Unit = {
                            IconButton(
                                onClick = onBack,
                                modifier = Modifier.size(48.dp).testTag("circleDetailBack"),
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = stringResource(R.string.back),
                                    tint = colorResource(R.color.artwork_on_scrim),
                                )
                            }
                        }
                        Box(
                            Modifier
                                .padding(top = topPadding + 8.dp)
                                .padding(contentPadding.horizontalInset()),
                        ) { backButton() }
                    }
                }
                LazyColumn(
                    Modifier.weight(1f).fillMaxWidth().testTag("circlesList"),
                    contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding()),
                ) {
                    item(key = "circle-detail-content") {
                        Column(
                            Modifier.fillMaxWidth().padding(20.dp)
                                .padding(contentPadding.horizontalInset()),
                        ) {
                            circle.description?.let {
                                Text(circleDescription(it), modifier = Modifier.padding(vertical = 16.dp))
                            }
                            if (!membershipsLoaded && isLoading) CircularProgressIndicator()
                            Button(
                                onClick = onToggleMembership,
                                enabled = membershipsLoaded && !isUpdating,
                            ) {
                                Text(stringResource(if (isMember) R.string.screen_leave_circle else R.string.screen_join_circle))
                            }
                            if (failure?.kind != CirclesFailureKind.CIRCLE_MEMBERS_LOAD) {
                                failureMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                                if (canRetryLoad) Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                            }
                            if (isMember && membershipsLoaded) {
                                if (isLoadingMembers) {
                                    CircularProgressIndicator(Modifier.padding(top = 20.dp))
                                } else if (failure?.kind == CirclesFailureKind.CIRCLE_MEMBERS_LOAD) {
                                    Text(
                                        failureMessage ?: stringResource(R.string.screen_circle_members_load_error),
                                        color = MaterialTheme.colorScheme.error,
                                        modifier = Modifier.padding(top = 20.dp),
                                    )
                                    if (canRetryLoad) Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                                } else if (memberGroups != null) {
                                    CircleMemberDiscovery(
                                        groups = memberGroups,
                                        api = api,
                                        session = session,
                                        onOpenProfile = onOpenProfile,
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

@Composable
private fun CircleMemberDiscovery(
    groups: CircleMemberGroups,
    api: MobileApiClient,
    session: MemberSession,
    onOpenProfile: (String) -> Unit,
) {
    val allEmpty = groups.contacts.isEmpty() &&
        groups.recommenders.isEmpty() &&
        groups.active.isEmpty()
    if (allEmpty) {
        Text(
            stringResource(R.string.screen_circle_members_empty),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 24.dp),
        )
        return
    }
    CircleMemberGroup(
        title = stringResource(R.string.screen_circle_contacts_title),
        subtitle = stringResource(R.string.screen_circle_contacts_subtitle),
        members = groups.contacts,
        api = api,
        session = session,
        onOpenProfile = onOpenProfile,
    )
    CircleMemberGroup(
        title = stringResource(R.string.screen_circle_recommenders_title),
        subtitle = stringResource(R.string.screen_circle_recommenders_subtitle),
        members = groups.recommenders,
        api = api,
        session = session,
        onOpenProfile = onOpenProfile,
    )
    CircleMemberGroup(
        title = stringResource(R.string.screen_circle_active_title),
        subtitle = stringResource(R.string.screen_circle_active_subtitle),
        members = groups.active,
        api = api,
        session = session,
        onOpenProfile = onOpenProfile,
    )
}

@Composable
private fun CircleMemberGroup(
    title: String,
    subtitle: String,
    members: List<MessageMember>,
    api: MobileApiClient,
    session: MemberSession,
    onOpenProfile: (String) -> Unit,
) {
    if (members.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(top = 24.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(
            subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        members.forEach { member ->
            Row(
                modifier = Modifier.fillMaxWidth().clickable {
                    member.username?.let(onOpenProfile)
                }.padding(vertical = 12.dp).testTag("circleMember-${member.username}"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RemoteArtwork(
                    url = member.id?.let { api.avatarURL(it, 64) },
                    sessionCookie = session.cookieHeader,
                    label = member.displayName,
                    size = 48.dp,
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(member.displayName.ifBlank { member.username.orEmpty() }, fontWeight = FontWeight.Bold)
                    member.username?.let { Text("@$it", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
            HorizontalDivider()
        }
    }
}

