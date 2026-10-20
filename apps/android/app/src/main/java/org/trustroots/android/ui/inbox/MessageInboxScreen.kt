@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.inbox

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageThread
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.LiveFilterField
import org.trustroots.android.ui.common.MemberLargeTopAppBar
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.localizedLabel
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.ui.conversation.ConversationScreen
import org.trustroots.android.ui.profile.MemberProfileScreen

@Composable
internal fun MessageInboxScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    initialMemberID: String? = null,
    initialVisitID: Long = 0L,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    var threads by remember(initialVisitID) { mutableStateOf<List<MessageThread>>(emptyList()) }
    var filter by rememberSaveable(initialVisitID) { mutableStateOf("") }
    var loading by remember(initialVisitID) { mutableStateOf(false) }
    var error by remember(initialVisitID) { mutableStateOf<UiFailure?>(null) }
    var loaded by remember(initialVisitID) { mutableStateOf(false) }
    var reload by remember(initialVisitID) { mutableStateOf(0) }
    val listState = rememberLazyListState()
    val initialRoutes: Array<NavKey> = if (initialMemberID == null) {
        arrayOf(MessageInboxVisit(initialVisitID))
    } else {
        arrayOf(
            MessageInboxVisit(initialVisitID),
            MessageConversationVisit(initialMemberID, initialVisitID + 1L),
        )
    }
    val backStack = rememberNavBackStack(*initialRoutes)
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val popRoute: () -> Unit = {
        if (backStack.size > 1) {
            if (backStack.lastOrNull() is MessageConversationVisit) reload++
            backStack.removeLastOrNull()
        }
    }
    var nextRouteID by rememberSaveable(initialVisitID) {
        mutableStateOf(initialVisitID + if (initialMemberID == null) 1L else 2L)
    }
    val pushConversation: (String) -> Unit = { memberID ->
        backStack.add(MessageConversationVisit(memberID, nextRouteID++))
    }
    val pushProfile: (String) -> Unit = { memberIDOrUsername ->
        backStack.add(MessageProfileVisit(memberIDOrUsername, nextRouteID++))
    }

    LaunchedEffect(reload, initialVisitID) {
        loading = true
        error = null
        val collected = mutableListOf<MessageThread>()
        var page = 1
        do {
            val batch = api.inbox(session, page).getOrElse {
                if (it.isAuthenticationFailure()) onSessionInvalidated()
                else if (collected.isEmpty()) error = it.toUiFailure(UiFailureFallback.LOAD_MESSAGES)
                break
            }
            collected += batch
            threads = collected.distinctBy { it.id }
            page++
        } while (batch.size == 50)
        loaded = true
        loading = false
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
            entry<MessageInboxVisit> {
                InboxContent(
                    threads = threads,
                    filter = filter,
                    onFilterChange = { filter = it },
                    loading = loading,
                    loaded = loaded,
                    error = error,
                    api = api,
                    session = session,
                    contentPadding = contentPadding,
                    scrollBehavior = scrollBehavior,
                    listState = listState,
                    onOpenConversation = pushConversation,
                    onOpenProfile = pushProfile,
                )
            }
            entry<MessageConversationVisit> { route ->
                val member = threads.firstOrNull { it.otherMember.id == route.memberID }?.otherMember
                when {
                    member != null -> ConversationScreen(
                        api = api,
                        session = session,
                        member = member,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = popRoute,
                        onOpenProfile = member.username?.let { { pushProfile(member.id ?: it) } },
                        contentPadding = contentPadding,
                    )
                    !loaded -> MessageRouteLoading()
                    else -> MessageRouteUnavailable(onBack = popRoute)
                }
            }
            entry<MessageProfileVisit> { route ->
                val member = threads.firstOrNull {
                    it.otherMember.id == route.memberIDOrUsername ||
                        it.otherMember.username == route.memberIDOrUsername
                }?.otherMember
                if (member?.username != null) {
                    MemberProfileScreen(
                        api = api,
                        session = session,
                        username = member.username,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = popRoute,
                        contentPadding = contentPadding,
                    )
                } else if (!loaded) {
                    MessageRouteLoading()
                } else {
                    MessageRouteUnavailable(onBack = popRoute)
                }
            }
        },
    )
}

@Composable
private fun InboxContent(
    threads: List<MessageThread>,
    filter: String,
    onFilterChange: (String) -> Unit,
    loading: Boolean,
    loaded: Boolean,
    error: UiFailure?,
    api: MobileApiClient,
    session: MemberSession,
    contentPadding: PaddingValues,
    scrollBehavior: androidx.compose.material3.TopAppBarScrollBehavior,
    listState: LazyListState,
    onOpenConversation: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
) {
    val memberLabels = threads.associate { thread -> thread.id to thread.otherMember.localizedLabel() }
    val filteredThreads = threads.filter { thread ->
        val text = "${memberLabels[thread.id].orEmpty()} ${thread.otherMember.username.orEmpty()} ${thread.excerpt}"
        text.contains(filter.trim(), ignoreCase = true)
    }
    Scaffold(
        modifier = Modifier.fillMaxSize().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            MemberLargeTopAppBar(
                title = stringResource(R.string.screen_messages_title),
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
            )
        },
    ) { appBarPadding ->
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().padding(top = appBarPadding.calculateTopPadding()),
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + 20.dp),
        ) {
            item(key = "message-inbox-controls") {
                Column(
                    Modifier.fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(contentPadding.horizontalInset()),
                ) {
                    LiveFilterField(
                        value = filter,
                        onValueChange = onFilterChange,
                        label = stringResource(R.string.filter_conversations),
                        clearLabel = stringResource(R.string.clear_conversation_filter),
                    )
                    if (loading) CircularProgressIndicator()
                    error?.let { Text(resolveFailureMessage(it), color = MaterialTheme.colorScheme.error) }
                    if (loaded && threads.isEmpty() && error == null) {
                        Text(stringResource(R.string.screen_no_conversations))
                    }
                }
            }
            items(filteredThreads, key = { it.id }) { thread ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { thread.otherMember.id?.let(onOpenConversation) }
                        .testTag("message-thread-${thread.id}")
                        .padding(horizontal = 20.dp)
                        .padding(vertical = 8.dp)
                        .padding(contentPadding.horizontalInset()),
                ) {
                    Row(Modifier.weight(1f)) {
                        RemoteArtwork(
                            url = thread.otherMember.id?.let { api.avatarURL(it, 64) },
                            sessionCookie = session.cookieHeader,
                            label = memberLabels[thread.id].orEmpty(),
                            size = 44.dp,
                        )
                        Column(Modifier.padding(start = 10.dp)) {
                            Text(memberLabels[thread.id].orEmpty(), fontWeight = if (thread.read) FontWeight.Normal else FontWeight.Bold)
                            Text(thread.excerpt, maxLines = 2)
                        }
                    }
                    thread.otherMember.username?.let { username ->
                        OutlinedButton(onClick = { onOpenProfile(thread.otherMember.id ?: username) }) {
                            Text(stringResource(R.string.screen_profile))
                        }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun MessageRouteLoading() {
    Column(Modifier.fillMaxSize().padding(24.dp)) { CircularProgressIndicator() }
}

@Composable
private fun MessageRouteUnavailable(onBack: () -> Unit) {
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        topBar = {
            MemberLargeTopAppBar(
                title = stringResource(R.string.screen_messages_title),
                scrollBehavior = scrollBehavior,
                contentPadding = PaddingValues.Zero,
                onBack = onBack,
            )
        },
    ) { padding ->
        Text(
            stringResource(R.string.screen_no_conversations),
            modifier = Modifier.padding(padding).padding(24.dp),
        )
    }
}
