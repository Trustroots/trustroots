package org.trustroots.android.ui.hostmap

import android.text.Html
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.trustroots.android.R
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.MemberIdentity
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.requestResult
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.common.toUiFailure

/** Cached pins can outlive a pan while the replacement search is in flight. */
internal fun visibleMapOffers(offers: List<MapOffer>, bounds: MapBounds?): List<MapOffer> {
    if (bounds == null) return emptyList()
    return offers.filter { offer ->
        offer.latitude in bounds.south..bounds.north &&
            if (bounds.west <= bounds.east) offer.longitude in bounds.west..bounds.east
            else offer.longitude >= bounds.west || offer.longitude <= bounds.east
    }
}

@Composable
internal fun HostMapResults(
    offers: List<MapOffer>,
    loading: Boolean,
    failure: UiFailure?,
    api: MobileApiClient,
    session: MemberSession,
    onRetrySearch: () -> Unit,
    onOpenOffer: (MapOffer) -> Unit,
    onSessionInvalidated: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Lazy rows request only composed entries; the limit also bounds simultaneous requests
    // when a large screen or rapid scrolling composes several new rows at once.
    val requests = remember(api.backendURL, session.credentialKey, session.member.username) { Semaphore(4) }
    var invalidationDelivered by remember(api.backendURL, session.credentialKey, session.member.username) { mutableStateOf(false) }
    val invalidateOnce: () -> Unit = {
        if (!invalidationDelivered) {
            invalidationDelivered = true
            onSessionInvalidated()
        }
    }
    val listState = rememberLazyListState()
    LazyColumn(
        modifier = modifier.testTag("hostMapResults"),
        state = listState,
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "heading") {
            Text(stringResource(R.string.screen_map_results_heading), style = MaterialTheme.typography.titleMedium)
        }
        if (loading) item(key = "loading") {
            CircularProgressIndicator(Modifier.testTag("mapResultsLoading"))
            Text(stringResource(R.string.screen_searching_area))
        }
        if (failure != null) item(key = "failure") {
            Text(resolveFailureMessage(failure), color = MaterialTheme.colorScheme.error)
            TextButton(onClick = onRetrySearch) { Text(stringResource(R.string.retry)) }
        }
        if (!loading && failure == null && offers.isEmpty()) item(key = "empty") {
            Text(stringResource(R.string.screen_map_results_empty))
        }
        items(offers, key = { "${it.type}-${it.id}" }) { offer ->
            key(api.backendURL, session.credentialKey, session.member.username) {
                HostMapResultEntry(offer, api, session, requests, onOpenOffer, invalidateOnce)
            }
        }
    }
}

@Composable
private fun HostMapResultEntry(
    mapOffer: MapOffer,
    api: MobileApiClient,
    session: MemberSession,
    requests: Semaphore,
    onOpenOffer: (MapOffer) -> Unit,
    onSessionInvalidated: () -> Unit,
) {
    var retry by remember(mapOffer.id, api.backendURL, session.credentialKey) { mutableIntStateOf(0) }
    val result by produceState<Result<HostOffer>?>(null, mapOffer.id, api.backendURL, session.credentialKey, retry) {
        value = null
        value = requests.withPermit { requestResult { api.hostOffer(session, mapOffer.id) } }
    }
    val error = result?.exceptionOrNull()
    LaunchedEffect(error) {
        if (error?.isAuthenticationFailure() == true) onSessionInvalidated()
    }
    val offer = result?.getOrNull()
    Card(
        onClick = { onOpenOffer(mapOffer) },
        enabled = offer != null,
        modifier = Modifier.fillMaxWidth().testTag("map-result-${mapOffer.id}"),
    ) {
        Column(Modifier.padding(12.dp)) {
            when {
                offer != null -> {
                    MemberIdentity(api = api, session = session, member = offer.user)
                    Text(
                        stringResource(when {
                            mapOffer.type == "meet" -> offer.meetingLabelResource() ?: R.string.screen_host_available_to_meet
                            offer.status == "yes" -> R.string.screen_hosting_travellers
                            offer.status == "maybe" -> R.string.screen_maybe_hosting
                            else -> R.string.screen_not_hosting_currently
                        }),
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    if (mapOffer.type == "host") {
                        offer.meetingLabelResource()?.let { Text(stringResource(it), style = MaterialTheme.typography.labelLarge) }
                    }
                    if (offer.volunteering) {
                        Text(stringResource(R.string.screen_filter_volunteering), style = MaterialTheme.typography.labelLarge)
                    }
                    offer.description?.takeIf { mapOffer.type == "meet" || offer.status in setOf("yes", "maybe") }?.let { description ->
                        Text(
                            Html.fromHtml(description, Html.FROM_HTML_MODE_COMPACT).toString().trim(),
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                error != null -> {
                    Text(resolveFailureMessage(error.toUiFailure(UiFailureFallback.LOAD_HOST)), color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = { retry++ }, modifier = Modifier.testTag("map-result-retry-${mapOffer.id}")) {
                        Text(stringResource(R.string.retry))
                    }
                }
                else -> {
                    CircularProgressIndicator()
                    Text(stringResource(R.string.screen_map_result_loading))
                }
            }
        }
    }
}

internal fun HostOffer.meetingLabelResource(): Int? = when (meetingStatus) {
    "yes" -> R.string.screen_search_happy_to_meet
    "maybe" -> R.string.screen_search_might_meet
    else -> null
}
