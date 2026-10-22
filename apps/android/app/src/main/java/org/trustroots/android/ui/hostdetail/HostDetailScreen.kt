package org.trustroots.android.ui.hostdetail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.hostmap.HostResultCard
import org.trustroots.android.ui.search.HostDetailVisit
import org.trustroots.android.ui.search.SearchOfferType
import org.trustroots.android.ui.theme.HostResultCardTheme

@Composable
internal fun HostDetailScreen(
    api: MobileApiClient,
    session: MemberSession,
    route: HostDetailVisit,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onSessionInvalidated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
    viewModel: HostDetailViewModel? = null,
) {
    val model = viewModel ?: rememberHostDetailViewModel(api, session)
    val state by model.state.collectAsState()
    val retryLabel = stringResource(R.string.retry)
    val closeLabel = stringResource(R.string.screen_close_host_result)
    val offer = state.offer

    LaunchedEffect(model, route.visitID, route.offerID, route.offerType) {
        model.onEvent(HostDetailEvent.Load(route.offerID, route.offerType))
    }
    LaunchedEffect(model, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        model.onEvent(HostDetailEvent.SessionInvalidationDelivered(pending.id))
    }

    HostResultCardTheme {
        BoxWithConstraints(
            Modifier.fillMaxSize().testTag("hostDetailRoute"),
            contentAlignment = Alignment.BottomCenter,
        ) {
            val maxCardHeight = maxHeight * 0.58f
            Surface(
                modifier = Modifier.fillMaxWidth()
                    .padding(contentPadding.horizontalInset())
                    .padding(bottom = contentPadding.calculateBottomPadding())
                    .testTag("hostDetailSheet"),
                color = MaterialTheme.colorScheme.surface,
                shape = MaterialTheme.shapes.large,
                tonalElevation = 0.dp,
            ) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    when {
                        offer != null -> HostResultCard(
                            offer = offer,
                            profile = state.profile,
                            sharedCircleIDs = state.sharedCircleIDs,
                            isMeet = route.offerType == SearchOfferType.Meet,
                            api = api,
                            session = session,
                            maxHeight = maxCardHeight,
                            onClose = onBack,
                            onOpenProfile = {
                                offer.user.username?.let(onOpenProfile)
                            },
                        )
                        else -> Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (state.isLoading) CircularProgressIndicator(modifier = Modifier.testTag("hostDetailLoading"))
                            else Spacer(Modifier.weight(1f))
                            IconButton(onClick = onBack, modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) {
                                Icon(Icons.Default.Close, contentDescription = closeLabel)
                            }
                        }
                    }
                    state.failure?.let { failure ->
                        Row(
                            Modifier.fillMaxWidth().padding(top = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                resolveFailureMessage(failure),
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.weight(1f),
                            )
                            Spacer(Modifier.width(8.dp))
                            TextButton(
                                onClick = { model.onEvent(HostDetailEvent.Retry) },
                                modifier = Modifier.testTag("hostDetailRetry"),
                            ) { Text(retryLabel) }
                        }
                    }
                    if (state.isLoading && offer != null) {
                        CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 8.dp))
                    }
                }
            }
        }
    }
}
