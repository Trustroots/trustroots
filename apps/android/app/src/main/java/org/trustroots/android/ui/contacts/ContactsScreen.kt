@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.contacts

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.resolveFailureMessage

@Composable
internal fun ContactsScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val model = rememberContactsViewModel(api, session)
    val state by model.state.collectAsState()
    val failure = state.failure
    val contactsTitle = stringResource(R.string.screen_contacts_title)
    val contactsEmpty = stringResource(R.string.screen_contacts_empty)
    val usernameHandleFormat = stringResource(R.string.screen_username_handle)
    val uiLocale = LocalConfiguration.current.locales[0]

    LaunchedEffect(model, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        model.onEvent(ContactsEvent.SessionInvalidationDelivered(pending.id))
    }

    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    Scaffold(
        modifier = Modifier.fillMaxSize().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            PinnedTopAppBar(
                title = contactsTitle,
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
                onBack = onBack,
            )
        },
    ) { appBarPadding ->
        val bottomPadding = appBarPadding.calculateBottomPadding() + contentPadding.calculateBottomPadding()
        when {
            state.isLoading -> Box(
                Modifier.fillMaxSize()
                    .padding(top = appBarPadding.calculateTopPadding(), bottom = bottomPadding)
                    .padding(20.dp),
            ) {
                CircularProgressIndicator(modifier = Modifier.padding(top = 20.dp))
            }
            state.isSessionInvalidated -> Unit
            failure != null -> Box(
                Modifier.fillMaxSize()
                    .padding(top = appBarPadding.calculateTopPadding(), bottom = bottomPadding)
                    .padding(20.dp),
            ) {
                Column(Modifier.padding(top = 16.dp)) {
                    Text(
                        resolveFailureMessage(
                            UiFailure(
                                serverMessage = failure.serverMessage,
                                apiKind = failure.apiKind,
                                fallback = UiFailureFallback.LOAD_CONTACTS,
                            ),
                        ),
                        color = MaterialTheme.colorScheme.error,
                    )
                    TextButton(
                        onClick = { model.onEvent(ContactsEvent.Retry) },
                        modifier = Modifier.testTag("contactsRetry"),
                    ) {
                        Text(stringResource(R.string.screen_contacts_retry))
                    }
                }
            }
            state.contacts.isEmpty() -> Box(
                Modifier.fillMaxSize()
                    .padding(top = appBarPadding.calculateTopPadding(), bottom = bottomPadding)
                    .padding(20.dp),
            ) {
                Text(
                    contactsEmpty,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
            else -> LazyColumn(
                Modifier.fillMaxSize()
                    .padding(top = appBarPadding.calculateTopPadding())
                    .padding(contentPadding.horizontalInset())
                    .testTag("contactsList"),
                contentPadding = PaddingValues(
                    start = 20.dp,
                    end = 20.dp,
                    top = 12.dp,
                    bottom = bottomPadding + 12.dp,
                ),
            ) {
                items(state.contacts, key = { it.id }) { contact ->
                    val username = contact.user.username
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .then(if (username != null) Modifier.clickable { onOpenProfile(username) } else Modifier)
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RemoteArtwork(
                            url = contact.user.id?.let { api.avatarURL(it, 64) },
                            sessionCookie = session.cookieHeader,
                            label = contact.user.displayName,
                            size = 54.dp,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(contact.user.displayName, fontWeight = FontWeight.Bold)
                            username?.let { Text(String.format(uiLocale, usernameHandleFormat, it)) }
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
