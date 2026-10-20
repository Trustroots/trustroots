package org.trustroots.android.ui.membersearch

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.R
import org.trustroots.android.ui.common.SubmittedSearchField
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
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
) {
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    var query by remember { mutableStateOf("") }
    var queryRevision by remember { mutableIntStateOf(0) }
    var results by remember { mutableStateOf<List<MemberProfile>>(emptyList()) }
    var selected by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(selected) { onProfileOpenChange(selected != null) }
    var loading by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val updateQuery: (String) -> Unit = {
        queryRevision++
        query = it
        searched = false
        error = null
        results = emptyList()
    }
    val search: () -> Unit = search@{
        if (query.trim().length < 3 || loading) return@search
        val revision = queryRevision
        val submittedQuery = query
        keyboard?.hide()
        focusManager.clearFocus()
        loading = true
        error = null
        scope.launch {
            api.searchMembers(session, submittedQuery).onSuccess {
                if (revision == queryRevision) { results = it; searched = true }
            }
                .onFailure {
                    if (it.isAuthenticationFailure()) onSessionInvalidated()
                    else if (revision == queryRevision) error = it.messageOr("Could not search members.")
                }
            loading = false
        }
    }
    selected?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated, onBack = { selected = null }, contentPadding = contentPadding)
        return
    }
    Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding())) {
        Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        SubmittedSearchField(
            value = query,
            onValueChange = updateQuery,
            label = stringResource(R.string.member_search_hint),
            clearLabel = stringResource(R.string.clear_member_search),
            searchLabel = stringResource(R.string.search_members),
            searchMode = searchMode,
            onSearch = search,
            searchEnabled = query.trim().length >= 3 && !loading,
            modifier = Modifier.fillMaxWidth().padding(contentPadding.horizontalInset()).padding(8.dp).testTag("memberSearchField"),
        )
        }
        if (query.trim().isNotEmpty() && query.trim().length < 3) Text("Enter at least 3 characters.")
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (searched && results.isEmpty()) Text("No members found. Try another name or username.")
        if (!searched && results.isEmpty() && !loading && error == null) {
            Column(
                Modifier.weight(1f).fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Icons.Default.People, null, modifier = Modifier.size(72.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
                Text("Find a member", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 16.dp))
                Text("Search name or username", textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
                if (onSwitchToMap != null) {
                    HorizontalDivider(Modifier.padding(vertical = 24.dp))
                    TextButton(onClick = onSwitchToMap) {
                        Icon(Icons.Default.Place, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Switch to map search")
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
            results.forEach { member ->
                Row(Modifier.fillMaxWidth().clickable { selected = member.username }.padding(vertical = 12.dp).padding(horizontal = 20.dp).padding(contentPadding.horizontalInset())) {
                    RemoteArtwork(
                        url = member.id?.let { api.avatarURL(it, 64) },
                        sessionCookie = session.cookieHeader,
                        label = member.displayName,
                        size = 54.dp,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(member.displayName, fontWeight = FontWeight.Bold)
                        Text("@${member.username}")
                        member.location?.let { Text(it) }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}
