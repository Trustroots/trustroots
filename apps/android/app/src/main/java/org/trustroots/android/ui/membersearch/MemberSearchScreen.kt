package org.trustroots.android.ui.membersearch

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MemberSearchFilters
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.LabelledCheckbox
import org.trustroots.android.ui.common.MemberIdentity
import org.trustroots.android.ui.common.SubmittedSearchField
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.languageCatalogue
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.common.memberLocationLabel
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.common.searchFilterLanguages

@Composable
internal fun MemberSearchScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onOpenProfile: (String) -> Unit = {},
    searchModeMenu: (@Composable () -> Unit)? = null,
    onSwitchToMap: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues.Zero,
    viewModel: MemberSearchViewModel? = null,
) {
    val model = viewModel ?: rememberMemberSearchViewModel(api, session)
    val state by model.state.collectAsState()
    var showingFilters by remember { mutableStateOf(false) }
    var circles by remember(api, session.credentialKey) { mutableStateOf<List<TrustrootsCircle>?>(null) }
    LaunchedEffect(showingFilters, api, session.credentialKey) {
        if (showingFilters && circles == null) circles = api.circles(session).getOrNull()
    }
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    val scrollState = remember { ScrollState(state.resultScrollOffset) }
    LaunchedEffect(scrollState, model) {
        snapshotFlow { scrollState.value }
            .distinctUntilChanged()
            .collect { model.onEvent(MemberSearchEvent.ResultsScrolled(it)) }
    }
    LaunchedEffect(scrollState, state.resultScrollOffset) {
        if (scrollState.value != state.resultScrollOffset) scrollState.scrollTo(state.resultScrollOffset)
    }
    LaunchedEffect(model, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        model.onEvent(MemberSearchEvent.SessionInvalidationDelivered(pending.id))
    }
    val failure = state.failure?.let {
        UiFailure(
            serverMessage = it.serverMessage,
            apiKind = it.apiKind,
            fallback = UiFailureFallback.SEARCH_MEMBERS,
        )
    }
    Column(
        Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding()),
    ) {
        Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
            SubmittedSearchField(
                value = state.query,
                onValueChange = { model.onEvent(MemberSearchEvent.QueryChanged(it)) },
                label = stringResource(R.string.member_search_hint),
                clearLabel = stringResource(R.string.clear_member_search),
                searchLabel = stringResource(R.string.search_members),
                leadingIcon = searchModeMenu,
                onSearch = {
                    keyboard?.hide()
                    focusManager.clearFocus()
                    model.onEvent(MemberSearchEvent.Submit)
                },
                searchEnabled = state.query.trim().length >= 3 && !state.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(contentPadding.horizontalInset())
                    .padding(8.dp)
                    .testTag("memberSearchField"),
            )
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.End) {
            if (onSwitchToMap != null) {
                TextButton(onClick = {
                    keyboard?.hide()
                    focusManager.clearFocus()
                    onSwitchToMap()
                }) { Text(stringResource(R.string.screen_switch_to_map_search)) }
            }
            TextButton(
                onClick = {
                    keyboard?.hide()
                    focusManager.clearFocus()
                    showingFilters = true
                },
                enabled = !state.isLoading,
            ) {
                Text(stringResource(R.string.screen_member_filters))
            }
        }
        if (state.query.trim().isNotEmpty() && state.query.trim().length < 3) {
            Text(stringResource(R.string.screen_enter_at_least_three_characters))
        }
        if (state.isLoading) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            ) {
                CircularProgressIndicator()
                Text(
                    stringResource(R.string.screen_member_search_loading),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.semantics { heading() },
                )
                Text(stringResource(R.string.screen_member_search_loading_description))
            }
        }
        if (failure != null) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp)
                    .semantics { liveRegion = LiveRegionMode.Assertive }
                    .testTag("memberSearchFailure"),
            ) {
                Text(
                    stringResource(R.string.screen_member_search_unavailable),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.semantics { heading() },
                )
                Text(resolveFailureMessage(failure), color = MaterialTheme.colorScheme.error)
                TextButton(
                    onClick = { model.onEvent(MemberSearchEvent.Submit) },
                    modifier = Modifier.testTag("memberSearchRetry"),
                ) {
                    Text(stringResource(R.string.retry))
                }
            }
        } else if (state.hasSearched && state.results.isEmpty()) {
            Column(
                Modifier.fillMaxWidth().padding(20.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .testTag("memberSearchEmpty"),
            ) {
                Text(
                    stringResource(R.string.screen_no_members_found_title),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.semantics { heading() },
                )
                Text(stringResource(R.string.screen_no_members_found_description))
            }
        }
        if (!state.hasSearched && !state.isLoading && failure == null) {
            Column(
                Modifier.weight(1f).fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    painterResource(R.drawable.ic_material_person_search),
                    null,
                    modifier = Modifier.size(72.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
                Text(
                    stringResource(R.string.screen_find_member),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Text(
                    stringResource(R.string.screen_search_name_or_username),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
        Column(Modifier.fillMaxWidth().verticalScroll(scrollState)) {
            state.results.forEach { member ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clickable { onOpenProfile(member.username) }
                        .padding(vertical = 12.dp)
                        .padding(horizontal = 20.dp)
                        .padding(contentPadding.horizontalInset()),
                ) {
                    MemberIdentity(
                        api = api,
                        session = session,
                        member = MessageMember(member.id, member.username, member.displayName),
                    )
                    memberLocationLabel(member.locationLiving, member.locationFrom)?.let { Text(it) }
                }
                HorizontalDivider()
            }
        }
    }
    if (showingFilters) {
        MemberFiltersDialog(
            initial = state.filters,
            circles = circles,
            onDismiss = { showingFilters = false },
            onApply = {
                showingFilters = false
                model.onEvent(MemberSearchEvent.FiltersChanged(it))
            },
        )
    }
}

@Composable
private fun MemberFiltersDialog(
    initial: MemberSearchFilters,
    circles: List<TrustrootsCircle>?,
    onDismiss: () -> Unit,
    onApply: (MemberSearchFilters) -> Unit,
) {
    var filter by remember { mutableStateOf(initial) }
    var languageQuery by remember { mutableStateOf("") }
    val context = LocalContext.current
    val languages = remember(context, languageQuery, filter.languages) {
        val needle = languageQuery.trim()
        if (needle.isEmpty()) {
            (filter.languages + searchFilterLanguages).map { it to languageName(context, it) }
        } else {
            languageCatalogue(context).asSequence()
                .filter { (code, name) -> code.equals(needle, true) || name.contains(needle, true) }
                .map { it.key to languageName(context, it.key) }
                .take(50)
                .toList()
        }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.screen_member_filters)) },
        text = {
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 380.dp).testTag("memberFilters")) {
                item {
                    LabelledCheckbox(stringResource(R.string.screen_hosting), filter.hosts, { filter = filter.copy(hosts = it) })
                    LabelledCheckbox(stringResource(R.string.screen_meet), filter.meetings, { filter = filter.copy(meetings = it) })
                    LabelledCheckbox(stringResource(R.string.screen_filter_volunteering), filter.volunteering, { filter = filter.copy(volunteering = it) })
                    LabelledCheckbox(stringResource(R.string.screen_filter_connections_only), filter.connectionsOnly, { filter = filter.copy(connectionsOnly = it) })
                    LabelledCheckbox(stringResource(R.string.screen_member_filter_online_recently), filter.onlineRecently, { filter = filter.copy(onlineRecently = it) })
                    Text(stringResource(R.string.screen_destination_circles), style = MaterialTheme.typography.titleSmall)
                    if (circles.isNullOrEmpty()) Text(stringResource(R.string.screen_circles_empty_title))
                }
                items(circles.orEmpty(), key = { it.id }) { circle ->
                    LabelledCheckbox(circle.label, circle.id in filter.circleIDs, { checked ->
                        val selected = if (checked) filter.circleIDs + circle.id else filter.circleIDs - circle.id
                        filter = filter.copy(circleIDs = selected)
                    })
                }
                item {
                    OutlinedTextField(
                        value = languageQuery,
                        onValueChange = { languageQuery = it },
                        label = { Text(stringResource(R.string.screen_filter_find_language)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                items(languages, key = { it.first }) { (code, name) ->
                    LabelledCheckbox(name, code in filter.languages, { checked ->
                        val selected = if (checked) filter.languages + code else filter.languages - code
                        filter = filter.copy(languages = selected)
                    })
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onApply(filter) }) { Text(stringResource(R.string.screen_apply_member_filters)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        },
    )
}
