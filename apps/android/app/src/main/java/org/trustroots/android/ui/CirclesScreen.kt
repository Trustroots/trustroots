@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.LiveFilterField
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.bottomInset
import org.trustroots.android.ui.common.horizontalInset

@Composable
internal fun CirclesScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "CirclesScreen must be hosted by a Navigation 3 entry ViewModelStoreOwner"
    }
    val factory = remember(owner, api, session.member.username) {
        CirclesViewModel.Factory(MobileApiCircleRepository(api, session))
    }
    val viewModel = remember(owner, factory) {
        ViewModelProvider(owner, factory).get(CirclesViewModel::class.java)
    }
    SideEffect { viewModel.updateSession(session) }
    val state by viewModel.state.collectAsState()
    val failureMessage = when (val failure = state.failure) {
        null -> null
        else -> failure.serverMessage ?: stringResource(
            when (failure.kind) {
                CirclesFailureKind.CIRCLES_LOAD -> R.string.screen_circles_load_error
                CirclesFailureKind.MEMBERSHIPS_LOAD -> R.string.screen_circle_memberships_load_error
                CirclesFailureKind.MEMBERSHIP_UPDATE -> R.string.screen_circle_membership_update_error
            },
        )
    }
    val overviewScrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val detailScrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    LaunchedEffect(viewModel, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        viewModel.onEvent(CirclesEvent.SessionInvalidationDelivered(pending.id))
    }
    val selected = state.selectedCircle
    BackHandler(enabled = selected != null) {
        viewModel.onEvent(CirclesEvent.BackFromDetail)
    }
    val toggle: (TrustrootsCircle) -> Unit = { circle ->
        viewModel.onEvent(CirclesEvent.ToggleMembership(circle))
    }

    if (selected != null) {
        CircleDetailScreen(
            circle = selected,
            api = api,
            memberships = state.memberships,
            updating = state.updatingCircleID,
            error = failureMessage,
            canRetryLoad = state.canRetryLoad,
            onRetry = { viewModel.onEvent(CirclesEvent.RetryLoad) },
            scrollBehavior = detailScrollBehavior,
            contentPadding = contentPadding,
            onBack = { viewModel.onEvent(CirclesEvent.BackFromDetail) },
            onToggleMembership = toggle,
        )
    } else {
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
            scrollBehavior = overviewScrollBehavior,
            contentPadding = contentPadding,
            onSelect = { viewModel.onEvent(CirclesEvent.CircleSelected(it)) },
            onToggleMembership = toggle,
        )
    }
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
            CirclesLargeTopAppBar(
                title = stringResource(R.string.discover_circles),
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
                        stringResource(R.string.circles_overview_description),
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
                        Text("${circle.count} members")
                    }
                    if (circle.id in memberships) {
                        OutlinedButton(onClick = { onToggleMembership(circle) }, enabled = updating == null) {
                            Icon(Icons.Default.Check, contentDescription = null)
                            Text("Joined")
                        }
                    } else {
                        Button(onClick = { onToggleMembership(circle) }, enabled = updating == null) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Text("Join")
                        }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun CircleDetailScreen(
    circle: TrustrootsCircle,
    api: MobileApiClient,
    memberships: Set<String>,
    updating: String?,
    error: String?,
    canRetryLoad: Boolean,
    onRetry: () -> Unit,
    scrollBehavior: TopAppBarScrollBehavior,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onToggleMembership: (TrustrootsCircle) -> Unit,
) {
    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            CirclesLargeTopAppBar(
                title = circle.label,
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
                onBack = onBack,
            )
        },
    ) { appBarPadding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(top = appBarPadding.calculateTopPadding()).testTag("circlesList"),
        ) {
            item(key = "circle-detail-hero") {
                ArtworkHero(
                    url = if (circle.image) api.circleHeroURL(circle.slug) else null,
                    sessionCookie = null,
                    label = circle.label,
                    subtitle = "${circle.count} members",
                    background = circleColor(circle.color, MaterialTheme.colorScheme.secondary),
                    blurBackground = false,
                    testTag = "circleHero",
                    showTitle = false,
                )
            }
            item(key = "circle-detail-content") {
                Column(
                    Modifier.fillMaxWidth().padding(20.dp)
                        .padding(contentPadding.horizontalInset())
                        .padding(contentPadding.bottomInset()),
                ) {
                    circle.description?.let {
                        Text(circleDescription(it), modifier = Modifier.padding(vertical = 16.dp))
                    }
                    Button(onClick = { onToggleMembership(circle) }, enabled = updating == null) {
                        Text(if (circle.id in memberships) "Leave circle" else "Join circle")
                    }
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    if (canRetryLoad) {
                        Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun CirclesLargeTopAppBar(
    title: String,
    scrollBehavior: TopAppBarScrollBehavior,
    contentPadding: PaddingValues,
    onBack: (() -> Unit)? = null,
) {
    LargeTopAppBar(
        title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        modifier = Modifier.padding(contentPadding.horizontalInset()),
        windowInsets = WindowInsets(
            left = 0.dp,
            top = contentPadding.calculateTopPadding(),
            right = 0.dp,
            bottom = 0.dp,
        ),
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.back),
                    )
                }
            }
        },
        colors = TopAppBarDefaults.largeTopAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        scrollBehavior = scrollBehavior,
    )
}

private fun circleColor(value: String?, fallback: Color): Color =
    runCatching { Color(android.graphics.Color.parseColor("#$value")) }
        .getOrDefault(fallback)
