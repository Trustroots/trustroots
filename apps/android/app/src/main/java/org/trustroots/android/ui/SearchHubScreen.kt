package org.trustroots.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.theme.TrustrootsPaleGreen

@Composable
internal fun SearchModeMenu(tab: Int, onSelect: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (tab == 0) Icons.Default.Place else Icons.Default.PersonSearch, "Search mode")
                Icon(Icons.Default.ArrowDropDown, null)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            listOf("Hosts map", "Members").forEachIndexed { index, label ->
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
) {
    var tab by remember(initialTab) { mutableIntStateOf(initialTab) }
    var profileOpen by remember { mutableStateOf(false) }
    BackHandler(enabled = tab == 1 && initialTab == 0 && !profileOpen) { tab = 0 }
    val selectMode: (Int) -> Unit = { profileOpen = false; tab = it }
    when (tab) {
        0 -> HostMapScreen(
            api, session, onSessionInvalidated,
            onProfileOpenChange = { profileOpen = it },
            searchMode = { SearchModeMenu(tab, selectMode) },
        )
        else -> MemberSearchScreen(
            api, session, onSessionInvalidated,
            onProfileOpenChange = { profileOpen = it },
            searchMode = { SearchModeMenu(tab, selectMode) },
            onSwitchToMap = { selectMode(0) },
        )
    }
}
