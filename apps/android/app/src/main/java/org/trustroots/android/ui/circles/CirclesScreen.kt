@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.circles

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import org.trustroots.android.R
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.LiveFilterField
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.circledetail.CircleDetailEntry

@Composable
internal fun CirclesScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    CirclesNavigationDisplay(
        initialVisitID = 0L,
        api = api,
        session = session,
        onSessionInvalidated = onSessionInvalidated,
        contentPadding = contentPadding,
    )
}

@Composable
internal fun CirclesNavigationDisplay(
    initialVisitID: Long,
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val backStack = rememberNavBackStack(CircleOverviewVisit(initialVisitID))
    var nextVisitID by rememberSaveable(initialVisitID) { mutableLongStateOf(1L) }
    var membershipEventRevision by rememberSaveable(initialVisitID) { mutableLongStateOf(0L) }
    var pendingMembershipCircleID by rememberSaveable(initialVisitID) { mutableStateOf<String?>(null) }
    var pendingMembershipValue by rememberSaveable(initialVisitID) { mutableStateOf(false) }
    val popRoute: () -> Unit = { if (backStack.size > 1) backStack.removeLastOrNull() }
    val pushDetail: (String) -> Unit = { slug ->
        backStack.add(CircleDetailVisit(slug, nextVisitID++))
    }
    val reportMembershipChange: (String, Boolean) -> Unit = { circleID, isMember ->
        pendingMembershipCircleID = circleID
        pendingMembershipValue = isMember
        membershipEventRevision++
    }
    val decorators: List<NavEntryDecorator<NavKey>> = listOf(
        rememberSaveableStateHolderNavEntryDecorator(),
        rememberViewModelStoreNavEntryDecorator(),
    )
    NavDisplay(
        backStack = backStack,
        onBack = popRoute,
        entryDecorators = decorators,
        entryProvider = entryProvider {
            entry<CircleOverviewVisit> { _ ->
                CircleOverviewEntry(
                    api = api,
                    session = session,
                    onSessionInvalidated = onSessionInvalidated,
                    contentPadding = contentPadding,
                    onSelect = { circle -> pushDetail(circle.slug) },
                    membershipEventRevision = membershipEventRevision,
                    pendingMembershipCircleID = pendingMembershipCircleID,
                    pendingMembershipValue = pendingMembershipValue,
                    onMembershipEventConsumed = { pendingMembershipCircleID = null },
                )
            }
            entry<CircleDetailVisit> { route ->
                CircleDetailEntry(
                    slug = route.slug,
                    api = api,
                    session = session,
                    onSessionInvalidated = onSessionInvalidated,
                    contentPadding = contentPadding,
                    onBack = popRoute,
                    onMembershipChanged = reportMembershipChange,
                )
            }
        },
    )
}

@Composable
private fun CircleOverviewEntry(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues,
    onSelect: (TrustrootsCircle) -> Unit,
    membershipEventRevision: Long,
    pendingMembershipCircleID: String?,
    pendingMembershipValue: Boolean,
    onMembershipEventConsumed: () -> Unit,
) {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "CirclesScreen must be hosted by a Navigation 3 entry ViewModelStoreOwner"
    }
    val factory = remember(owner) {
        CirclesViewModel.Factory(MobileApiCircleRepository(api, session))
    }
    val viewModel = rememberEntryViewModel(owner, CirclesViewModel::class.java, factory)
    SideEffect { viewModel.updateEnvironment(api, session) }
    val state by viewModel.state.collectAsState()
    val failureMessage = circlesFailureMessage(state.failure)
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()

    LaunchedEffect(viewModel, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        viewModel.onEvent(CirclesEvent.SessionInvalidationDelivered(pending.id))
    }
    LaunchedEffect(viewModel, membershipEventRevision) {
        val circleID = pendingMembershipCircleID ?: return@LaunchedEffect
        viewModel.onEvent(CirclesEvent.MembershipChanged(circleID, pendingMembershipValue))
        onMembershipEventConsumed()
    }
    val toggle: (TrustrootsCircle) -> Unit = { circle ->
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
    }

    CircleOverviewScreen(
        api = api,
        circles = state.visibleCircles,
        memberships = state.memberships,
        filter = state.filter,
        onFilterChange = { viewModel.onEvent(CirclesEvent.FilterChanged(it)) },
        loading = state.isLoading,
        updating = state.updatingCircleID,
        error = failureMessage,
        canRetryLoad = state.canRetryLoad,
        onRetry = { viewModel.onEvent(CirclesEvent.RetryLoad) },
        scrollBehavior = scrollBehavior,
        contentPadding = contentPadding,
        onSelect = onSelect,
        onToggleMembership = toggle,
    )
}

@Composable
internal fun circlesFailureMessage(failure: CirclesFailure?): String? = failure?.let {
    resolveFailureMessage(
        UiFailure(
            serverMessage = it.serverMessage,
            apiKind = it.apiFailureKind,
            fallback = when (it.kind) {
                CirclesFailureKind.CIRCLES_LOAD, CirclesFailureKind.CIRCLE_DETAIL_LOAD -> UiFailureFallback.CIRCLES_LOAD
                CirclesFailureKind.MEMBERSHIPS_LOAD -> UiFailureFallback.CIRCLE_MEMBERSHIPS_LOAD
                CirclesFailureKind.MEMBERSHIP_UPDATE -> UiFailureFallback.CIRCLE_MEMBERSHIP_UPDATE
            },
        ),
    )
}

@Composable
private fun CircleOverviewScreen(
    api: MobileApiClient,
    circles: List<TrustrootsCircle>,
    memberships: Set<String>,
    filter: String,
    onFilterChange: (String) -> Unit,
    loading: Boolean,
    updating: String?,
    error: String?,
    canRetryLoad: Boolean,
    onRetry: () -> Unit,
    scrollBehavior: TopAppBarScrollBehavior,
    contentPadding: PaddingValues,
    onSelect: (TrustrootsCircle) -> Unit,
    onToggleMembership: (TrustrootsCircle) -> Unit,
) {
    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            PinnedTopAppBar(
                title = stringResource(R.string.screen_discover_circles),
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
            )
        },
    ) { appBarPadding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(top = appBarPadding.calculateTopPadding()).testTag("circlesList"),
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + 20.dp),
        ) {
            item(key = "circle-overview-intro") {
                Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(contentPadding.horizontalInset())) {
                    Text(
                        stringResource(R.string.screen_circles_description),
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                    LiveFilterField(
                        value = filter,
                        onValueChange = onFilterChange,
                        label = stringResource(R.string.filter_circles),
                        clearLabel = stringResource(R.string.clear_circle_filter),
                    )
                    if (loading) CircularProgressIndicator()
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    if (canRetryLoad) {
                        Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                    }
                }
            }
            items(circles, key = { it.id }) { circle ->
                Row(
                    Modifier.fillMaxWidth()
                        .clickable { onSelect(circle) }
                        .padding(horizontal = 16.dp, vertical = 9.dp)
                        .padding(contentPadding.horizontalInset()),
                ) {
                    RemoteArtwork(
                        url = if (circle.image) api.circleImageURL(circle.slug) else null,
                        sessionCookie = null,
                        label = circle.label,
                        size = 54.dp,
                        background = circleColor(circle.color, MaterialTheme.colorScheme.secondary),
                    )
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(circle.label, fontWeight = FontWeight.Bold)
                        Text(pluralStringResource(R.plurals.screen_circle_member_count, circle.count, circle.count))
                    }
                    if (circle.id in memberships) {
                        OutlinedButton(onClick = { onToggleMembership(circle) }, enabled = updating == null) {
                            Icon(Icons.Default.Check, contentDescription = null)
                            Text(stringResource(R.string.screen_joined))
                        }
                    } else {
                        Button(onClick = { onToggleMembership(circle) }, enabled = updating == null) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Text(stringResource(R.string.screen_join))
                        }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

internal fun circleColor(value: String?, fallback: Color): Color =
    runCatching { Color(android.graphics.Color.parseColor("#$value")) }
        .getOrDefault(fallback)
