package org.trustroots.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Surface
import org.trustroots.android.ui.theme.TrustrootsDarkGreen
import org.trustroots.android.ui.theme.TrustrootsPaleGreen
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.zIndex
import androidx.compose.ui.unit.dp
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient

@Composable
internal fun SearchHubScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    initialTab: Int = 0,
) {
    var tab by remember(initialTab) { mutableIntStateOf(initialTab) }
    var profileOpen by remember { androidx.compose.runtime.mutableStateOf(false) }
    Box(Modifier.fillMaxSize()) {
        when (tab) {
            0 -> HostMapScreen(api, session, onSessionInvalidated, onProfileOpenChange = { profileOpen = it })
            else -> Box(Modifier.fillMaxSize().padding(top = if (profileOpen) 0.dp else 48.dp)) {
                MemberSearchScreen(api, session, onSessionInvalidated, onProfileOpenChange = { profileOpen = it })
            }
        }
        if (!profileOpen) Surface(
            modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().zIndex(10f).testTag("map-tabs"),
            shadowElevation = 8.dp,
            color = TrustrootsPaleGreen,
        ) {
            TabRow(selectedTabIndex = tab, containerColor = TrustrootsPaleGreen, contentColor = TrustrootsDarkGreen) {
                Tab(selected = tab == 0, onClick = { profileOpen = false; tab = 0 }, text = { Text("Hosts map") })
                Tab(selected = tab == 1, onClick = { profileOpen = false; tab = 1 }, text = { Text("Members") })
            }
        }
    }
}
