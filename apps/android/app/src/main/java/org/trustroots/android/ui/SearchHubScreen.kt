package org.trustroots.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.membersearch.MemberSearchScreen
import org.trustroots.android.ui.membersearch.MemberSearchEvent
import org.trustroots.android.ui.membersearch.rememberMemberSearchViewModel

@Composable
internal fun SearchModeMenu(tab: Int, onSelect: (Int) -> Unit) {
    val searchMode = stringResource(R.string.screen_search_mode)
    val hostsMap = stringResource(R.string.screen_search_hosts_map)
    val members = stringResource(R.string.screen_search_members)
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (tab == 0) Icons.Default.Place else Icons.Default.PersonSearch, searchMode)
                Icon(Icons.Default.ArrowDropDown, null)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            listOf(hostsMap, members).forEachIndexed { index, label ->
                DropdownMenuItem(
                    text = { Text(label) },
                    leadingIcon = { Icon(if (index == 0) Icons.Default.Place else Icons.Default.PersonSearch, null) },
                    onClick = { expanded = false; onSelect(index) },
                )
            }
        }
    }
}

@Composable
internal fun SearchHubScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    initialTab: Int = 0,
    contentPadding: PaddingValues = PaddingValues.Zero,
    resetGeneration: Int = 0,
    resetVisitID: Long = -1L,
    ownerVisitID: Long = -1L,
) {
    val memberSearchViewModel = rememberMemberSearchViewModel(api, session)
    val entryInitialTab = rememberSaveable { initialTab }
    var tab by rememberSaveable { mutableIntStateOf(entryInitialTab) }
    var mapResetGeneration by rememberSaveable { mutableIntStateOf(0) }
    var appliedResetGeneration by rememberSaveable { mutableIntStateOf(0) }
    var profileOpen by remember { mutableStateOf(false) }
    LaunchedEffect(memberSearchViewModel, resetGeneration, resetVisitID, ownerVisitID) {
        if (resetGeneration > appliedResetGeneration && resetVisitID == ownerVisitID) {
            appliedResetGeneration = resetGeneration
            memberSearchViewModel.onEvent(MemberSearchEvent.Reset(resetGeneration))
            tab = 0
            profileOpen = false
            mapResetGeneration = resetGeneration
        }
    }
    BackHandler(enabled = tab == 1 && entryInitialTab == 0 && !profileOpen) { tab = 0 }
    val selectMode: (Int) -> Unit = { profileOpen = false; tab = it }
    when (tab) {
        0 -> androidx.compose.runtime.key(mapResetGeneration) {
            HostMapScreen(
                api, session, onSessionInvalidated,
                contentPadding = contentPadding,
                onProfileOpenChange = { profileOpen = it },
                searchMode = { SearchModeMenu(tab, selectMode) },
            )
        }
        else -> MemberSearchScreen(
            api, session, onSessionInvalidated,
            contentPadding = contentPadding,
            onProfileOpenChange = { profileOpen = it },
            searchMode = { SearchModeMenu(tab, selectMode) },
            onSwitchToMap = { selectMode(0) },
            viewModel = memberSearchViewModel,
        )
    }
}
