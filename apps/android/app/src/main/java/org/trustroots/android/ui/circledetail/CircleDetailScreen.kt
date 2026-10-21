@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.circledetail

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.circles.CirclesFailure
import org.trustroots.android.ui.circles.MobileApiCircleRepository
import org.trustroots.android.ui.common.MemberLargeTopAppBar
import org.trustroots.android.ui.circles.circleColor
import org.trustroots.android.ui.circles.circlesFailureMessage
import org.trustroots.android.ui.circles.circleDescription
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.bottomInset
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.rememberEntryViewModel

@Composable
internal fun CircleDetailEntry(
    slug: String,
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onMembershipChanged: (String, Boolean) -> Unit,
) {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "CircleDetailVisit must own its CircleDetailViewModel store"
    }
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
    CircleDetailScreen(
        slug = slug,
        circle = state.circle,
        api = api,
        membershipsLoaded = state.membershipsLoaded,
        isMember = state.isMember,
        isLoading = state.isLoading,
        isUpdating = state.isUpdating,
        failure = state.failure,
        canRetryLoad = state.canRetryLoad,
        onRetry = { viewModel.onEvent(CircleDetailEvent.RetryLoad) },
        scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(),
        contentPadding = contentPadding,
        onBack = onBack,
        onToggleMembership = { viewModel.onEvent(CircleDetailEvent.ToggleMembership) },
    )
}

@Composable
private fun CircleDetailScreen(
    slug: String,
    circle: TrustrootsCircle?,
    api: MobileApiClient,
    membershipsLoaded: Boolean,
    isMember: Boolean,
    isLoading: Boolean,
    isUpdating: Boolean,
    failure: CirclesFailure?,
    canRetryLoad: Boolean,
    onRetry: () -> Unit,
    scrollBehavior: TopAppBarScrollBehavior,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onToggleMembership: () -> Unit,
) {
    val failureMessage = circlesFailureMessage(failure)
    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            MemberLargeTopAppBar(
                title = circle?.label ?: stringResource(R.string.screen_discover_circles),
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
                onBack = onBack,
            )
        },
    ) { appBarPadding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(top = appBarPadding.calculateTopPadding()).testTag("circlesList"),
        ) {
            if (circle == null) {
                item(key = "circle-detail-loading-$slug") {
                    Column(
                        Modifier.fillMaxWidth().padding(20.dp)
                            .padding(contentPadding.horizontalInset())
                            .padding(contentPadding.bottomInset()),
                    ) {
                        if (isLoading) CircularProgressIndicator()
                        failureMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        if (canRetryLoad) Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                    }
                }
            } else {
                item(key = "circle-detail-hero") {
                    ArtworkHero(
                        url = if (circle.image) api.circleHeroURL(circle.slug) else null,
                        sessionCookie = null,
                        label = circle.label,
                        subtitle = pluralStringResource(R.plurals.screen_circle_member_count, circle.count, circle.count),
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
                        if (!membershipsLoaded && isLoading) CircularProgressIndicator()
                        Button(
                            onClick = onToggleMembership,
                            enabled = membershipsLoaded && !isUpdating,
                        ) {
                            Text(stringResource(if (isMember) R.string.screen_leave_circle else R.string.screen_join_circle))
                        }
                        failureMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        if (canRetryLoad) Button(onClick = onRetry) { Text(stringResource(R.string.retry)) }
                    }
                }
            }
        }
    }
}

