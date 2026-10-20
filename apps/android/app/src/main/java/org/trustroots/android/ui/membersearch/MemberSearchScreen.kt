package org.trustroots.android.ui.membersearch

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.distinctUntilChanged
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.SubmittedSearchField
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.profile.MemberProfileScreen

@Composable
internal fun MemberSearchScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onProfileOpenChange: (Boolean) -> Unit = {},
    searchMode: (@Composable () -> Unit)? = null,
    onSwitchToMap: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues.Zero,
    viewModel: MemberSearchViewModel? = null,
) {
    val model = viewModel ?: rememberMemberSearchViewModel(api, session)
    val state by model.state.collectAsState()
    val uiLocale = LocalConfiguration.current.locales[0]
    val usernameHandleFormat = stringResource(R.string.screen_username_handle)
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    var selected by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(selected) { onProfileOpenChange(selected != null) }
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
    selected?.let { username ->
        MemberProfileScreen(
            api,
            session,
            username,
            onSessionInvalidated,
            onBack = { selected = null },
            contentPadding = contentPadding,
        )
        return
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
                searchMode = searchMode,
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
        if (state.query.trim().isNotEmpty() && state.query.trim().length < 3) {
            Text(stringResource(R.string.screen_enter_at_least_three_characters))
        }
        if (state.isLoading) CircularProgressIndicator()
        failure?.let { Text(resolveFailureMessage(it), color = MaterialTheme.colorScheme.error) }
        if (state.hasSearched && state.results.isEmpty()) {
            Text(stringResource(R.string.screen_no_members_found))
        }
        if (!state.hasSearched && state.results.isEmpty() && !state.isLoading && failure == null) {
            Column(
                Modifier.weight(1f).fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    Icons.Default.People,
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
                if (onSwitchToMap != null) {
                    HorizontalDivider(Modifier.padding(vertical = 24.dp))
                    TextButton(onClick = onSwitchToMap) {
                        Icon(Icons.Default.Place, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.screen_switch_to_map_search))
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth().verticalScroll(scrollState)) {
            state.results.forEach { member ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { selected = member.username }
                        .padding(vertical = 12.dp)
                        .padding(horizontal = 20.dp)
                        .padding(contentPadding.horizontalInset()),
                ) {
                    RemoteArtwork(
                        url = member.id?.let { api.avatarURL(it, 64) },
                        sessionCookie = session.cookieHeader,
                        label = member.displayName,
                        size = 54.dp,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(member.displayName, fontWeight = FontWeight.Bold)
                        Text(String.format(uiLocale, usernameHandleFormat, member.username))
                        member.location?.let { Text(it) }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}
