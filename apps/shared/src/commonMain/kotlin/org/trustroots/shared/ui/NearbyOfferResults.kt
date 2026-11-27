package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

data class PilotNearbyOfferRow(
    val id: String,
    val title: String?,
    val username: String?,
    val memberId: String?,
    val badges: List<String>,
    val summary: String?,
    val failed: Boolean,
)

class NearbyOfferResultsState {
    internal var content by mutableStateOf(NearbyOfferResultsContent())
        private set

    fun update(loading: Boolean, error: String?, rows: List<PilotNearbyOfferRow>) {
        content = NearbyOfferResultsContent(loading, error, rows.toList())
    }
}

internal data class NearbyOfferResultsContent(
    val loading: Boolean = true,
    val error: String? = null,
    val rows: List<PilotNearbyOfferRow> = emptyList(),
)

@Composable
internal fun NearbyOfferResults(
    state: NearbyOfferResultsState,
    retry: () -> Unit,
    loadOffer: (String) -> Unit,
    openOffer: (String) -> Unit,
    avatar: @Composable (PilotNearbyOfferRow) -> Unit,
) {
    val content = state.content
    val palette = pilotPalette
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(palette.background),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            content.loading -> item {
                PilotText("Loading nearby offers…", Modifier.semantics { contentDescription = "Loading nearby offers" })
            }
            content.error != null -> item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PilotTitle("Nearby offers unavailable")
                    PilotError(content.error)
                    PilotButton("Try again", onClick = retry)
                }
            }
            content.rows.isEmpty() -> item {
                PilotTitle("No offers found")
                PilotText("Try moving the map or changing your search filters.")
            }
            else -> items(content.rows, key = { it.id }) { row ->
                val pending = row.title == null && !row.failed
                LaunchedEffect(row.id, pending) {
                    if (pending) loadOffer(row.id)
                }
                NearbyOfferResultRow(
                    row = row,
                    onOpen = { openOffer(row.id) },
                    onRetry = { loadOffer(row.id) },
                    avatar = { avatar(row) },
                )
            }
        }
    }
}

@Composable
private fun NearbyOfferResultRow(
    row: PilotNearbyOfferRow,
    onOpen: () -> Unit,
    onRetry: () -> Unit,
    avatar: @Composable () -> Unit,
) {
    val palette = pilotPalette
    val name = row.title ?: row.username ?: "Offer"
    val status = when {
        row.failed -> "Could not load offer"
        row.title == null -> "Loading offer"
        else -> ""
    }
    val accessibleName = (listOfNotNull(name, row.username?.takeIf { it != name }, status.ifEmpty { null }) + row.badges)
        .joinToString(", ")
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(palette.surface)
            .then(if (!row.failed && row.title != null) Modifier.clickable(role = Role.Button, onClick = onOpen) else Modifier)
            .testTag("search-result-${row.id}")
            .semantics { contentDescription = accessibleName }
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        avatar()
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            PilotText(name, strong = true)
            row.username?.let { PilotText("@$it", colour = palette.border) }
            if (status.isNotEmpty()) PilotText(status, colour = if (row.failed) palette.error else palette.border)
            row.summary?.takeIf { it.isNotBlank() }?.let { PilotText(it) }
            row.badges.forEach { badge ->
                PilotText(
                    badge,
                    Modifier.clip(CircleShape).background(palette.background).padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
        }
        if (row.failed) PilotButton("Retry", onClick = onRetry)
    }
}
