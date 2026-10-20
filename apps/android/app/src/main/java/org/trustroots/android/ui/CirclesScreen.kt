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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.ArtworkHero
import org.trustroots.android.ui.common.LiveFilterField
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.bottomInset
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr

@Composable
internal fun CirclesScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    var circles by remember { mutableStateOf<List<TrustrootsCircle>>(emptyList()) }
    var memberships by remember { mutableStateOf<Set<String>>(emptySet()) }
    var filter by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<TrustrootsCircle?>(null) }
    var updating by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val overviewScrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val detailScrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    BackHandler(enabled = selected != null) { selected = null }
    LaunchedEffect(session) {
        loading = true
        api.circles(session).onSuccess { circles = it }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr("Could not load circles.")
        }
        api.circleMemberships(session).onSuccess { memberships = it }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else error = it.messageOr("Could not load circle memberships.")
        }
        loading = false
    }
    val toggle: (TrustrootsCircle) -> Unit = { circle ->
        if (updating == null) {
            scope.launch {
                updating = circle.id
                error = null
                val joined = circle.id in memberships
                api.setCircleMembership(session, circle.id, joined).onSuccess {
                    memberships = if (joined) memberships - circle.id else memberships + circle.id
                }.onFailure {
                    if (it.isAuthenticationFailure()) onSessionInvalidated()
                    else error = it.messageOr("Could not update membership.")
                }
                updating = null
            }
        }
    }

    val visibleCircles = remember(circles, filter) {
        circles.filter { circle ->
            val description = circle.description?.let(::circleDescriptionText).orEmpty()
            "${circle.label} $description".contains(filter.trim(), ignoreCase = true)
        }.sortedWith(compareByDescending<TrustrootsCircle> { it.count }.thenBy { it.label })
    }

    val circle = selected
    if (circle != null) {
        CircleDetailScreen(
            circle = circle,
            api = api,
            memberships = memberships,
            updating = updating,
            error = error,
            scrollBehavior = detailScrollBehavior,
            contentPadding = contentPadding,
            onBack = { selected = null },
            onToggleMembership = toggle,
        )
        return
    }

    CircleOverviewScreen(
        api = api,
        circles = visibleCircles,
        memberships = memberships,
        filter = filter,
        onFilterChange = { filter = it },
        loading = loading,
        updating = updating,
        error = error,
        scrollBehavior = overviewScrollBehavior,
        contentPadding = contentPadding,
        onSelect = { selected = it },
        onToggleMembership = toggle,
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
