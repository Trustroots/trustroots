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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
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
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.localizedLabel
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.conversation.MessageConversationEntryScreen
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
    var conversationReturnGeneration by remember(initialVisitID) { mutableIntStateOf(0) }
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
            if (backStack.lastOrNull() is MessageConversationVisit) conversationReturnGeneration++
            backStack.removeLastOrNull()
        }
    }
    var nextRouteID by rememberSaveable(initialVisitID) {
        mutableStateOf(initialVisitID + if (initialMemberID == null) 1L else 2L)
    }
    val pushConversation: (String) -> Unit = { memberID ->
        backStack.add(MessageConversationVisit(memberID, nextRouteID++))
    }
    val pushProfile: (String) -> Unit = { username ->
        backStack.add(MessageProfileVisit(username, nextRouteID++))
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
                val model = rememberInboxViewModel(api, session)
                val state by model.state.collectAsState()
                LaunchedEffect(model, session) {
                    model.onEvent(InboxEvent.SessionChanged(session))
                }
                LaunchedEffect(model, api) { model.updateApi(api) }
                LaunchedEffect(model, conversationReturnGeneration) {
                    if (conversationReturnGeneration > 0) {
                        model.onEvent(InboxEvent.ReturnFromConversation)
                    }
                }
                LaunchedEffect(model, state.pendingSessionInvalidation?.id) {
                    val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
                    onSessionInvalidated()
                    model.onEvent(InboxEvent.SessionInvalidationDelivered(pending.id))
                }
                InboxContent(
                    state = state,
                    onFilterChange = { model.onEvent(InboxEvent.FilterChanged(it)) },
                    onRetry = { model.onEvent(InboxEvent.Retry) },
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
                MessageConversationEntryScreen(
                    memberID = route.memberID,
                    api = api,
                    session = session,
                    onSessionInvalidated = onSessionInvalidated,
                    onBack = popRoute,
                    onOpenProfile = pushProfile,
                    contentPadding = contentPadding,
                )
            }
            entry<MessageProfileVisit> { route ->
                MemberProfileScreen(
                    api = api,
                    session = session,
                    username = route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    onBack = popRoute,
                    contentPadding = contentPadding,
                )
            }
        },
    )
}
@Composable
private fun rememberInboxViewModel(
    api: MobileApiClient,
    session: MemberSession,
): InboxViewModel {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "Inbox must be hosted by a Navigation 3 ViewModelStoreOwner."
    }
    return remember(owner, session.member.username) {
        owner.inboxViewModel(api, session)
    }
}

@Composable
private fun InboxContent(
    state: InboxUiState,
    onFilterChange: (String) -> Unit,
    onRetry: () -> Unit,
    api: MobileApiClient,
    session: MemberSession,
    contentPadding: PaddingValues,
    scrollBehavior: androidx.compose.material3.TopAppBarScrollBehavior,
    listState: LazyListState,
    onOpenConversation: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
) {
    val threads = state.threads
    val filter = state.filter
    val memberLabels = threads.associate { thread -> thread.id to thread.otherMember.localizedLabel() }
    val filteredThreads = state.visibleThreads
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
                        modifier = Modifier.testTag("messageInboxFilter"),
                    )
                    if (state.isLoading) CircularProgressIndicator()
                    state.failure?.let { failure ->
                        Text(resolveFailureMessage(failure), color = MaterialTheme.colorScheme.error)
                        OutlinedButton(onClick = onRetry, modifier = Modifier.testTag("inboxRetry")) {
                            Text(stringResource(R.string.retry))
                        }
                    }
                    if (state.hasLoaded && threads.isEmpty() && state.failure == null) {
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
                    verticalAlignment = Alignment.CenterVertically,
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
                        OutlinedButton(onClick = { onOpenProfile(username) }) {
                            Text(stringResource(R.string.screen_profile))
                        }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}
