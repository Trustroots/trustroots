package org.trustroots.android.ui

import android.text.Html
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.RemoteArtwork

@Composable
internal fun HostResultCard(
    offer: HostOffer,
    profile: MemberProfile?,
    sharedCircleIDs: Set<String>,
    isMeet: Boolean,
    api: MobileApiClient,
    session: MemberSession,
    maxHeight: Dp = Dp.Unspecified,
    horizontalInset: PaddingValues = PaddingValues.Zero,
    onClose: () -> Unit,
    onOpenProfile: () -> Unit,
) {
    Card(onClick = onOpenProfile, enabled = offer.user.username != null, modifier = Modifier.fillMaxWidth().padding(horizontalInset).testTag("hostResultCard")) {
        Column(Modifier.heightIn(max = maxHeight).verticalScroll(rememberScrollState()).padding(12.dp)) {
            val status = when {
                isMeet -> "Available to meet"
                offer.status == "yes" -> "Hosting travellers"
                offer.status == "maybe" -> "Maybe hosting"
                else -> "Not hosting currently"
            }
            Row(verticalAlignment = Alignment.Top) {
                RemoteArtwork(offer.user.id?.let { api.avatarURL(it, 64) }, session.cookieHeader, offer.user.label, 64.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(offer.user.label, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    offer.user.username?.let { Text("@$it", style = MaterialTheme.typography.bodySmall) }
                    Surface(
                        color = if (offer.status == "yes" || isMeet) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.secondaryContainer,
                        shape = MaterialTheme.shapes.small,
                        modifier = Modifier.padding(top = 4.dp),
                    ) {
                        Row(Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(when {
                                isMeet || offer.status == "yes" -> Icons.Default.Check
                                offer.status == "maybe" -> Icons.Default.HelpOutline
                                else -> Icons.Default.Close
                            }, contentDescription = null)
                            Spacer(Modifier.width(4.dp))
                            Text(status, style = MaterialTheme.typography.labelLarge)
                        }
                    }
                }
                IconButton(onClick = onClose) { Icon(Icons.Default.Close, "Close host result") }
            }
            offer.maxGuests?.let { Text("Up to $it guests", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
            profile?.tagline?.takeIf { it.isNotBlank() }?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp)) }
            val shared = profile?.circles.orEmpty().filter { it.id in sharedCircleIDs }
            if (shared.isNotEmpty()) Text("Circles in common: ${shared.joinToString { it.label }}", style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
            offer.description?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), maxLines = 3, overflow = TextOverflow.Ellipsis) }
        }
    }
}
