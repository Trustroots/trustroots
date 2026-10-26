package org.trustroots.android.ui.hostmap

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
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.trustroots.android.api.HostOffer
import org.trustroots.android.R
import org.trustroots.android.ui.common.localizedLabel
import org.trustroots.android.ui.common.hostGuestCountLabel
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.memberLastActiveLabel
import org.trustroots.android.ui.theme.HostResultCardTheme

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
    val availableToMeet = stringResource(R.string.screen_host_available_to_meet)
    val hostingTravellers = stringResource(R.string.screen_hosting_travellers)
    val maybeHosting = stringResource(R.string.screen_maybe_hosting)
    val notHosting = stringResource(R.string.screen_not_hosting_currently)
    val closeHostResult = stringResource(R.string.screen_close_host_result)
    val uiLocale = LocalConfiguration.current.locales[0]
    val context = LocalContext.current
    val usernameHandleFormat = stringResource(R.string.screen_username_handle)
    HostResultCardTheme {
        Card(
            onClick = onOpenProfile,
            enabled = offer.user.username != null,
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
                disabledContainerColor = MaterialTheme.colorScheme.surface,
                disabledContentColor = MaterialTheme.colorScheme.onSurface,
            ),
            modifier = Modifier.fillMaxWidth().padding(horizontalInset).testTag("hostResultCard"),
        ) {
            Column(Modifier.heightIn(max = maxHeight).verticalScroll(rememberScrollState()).padding(12.dp)) {
                val status = when {
                    isMeet -> availableToMeet
                    offer.status == "yes" -> hostingTravellers
                    offer.status == "maybe" -> maybeHosting
                    else -> notHosting
                }
                Row(verticalAlignment = Alignment.Top) {
                    RemoteArtwork(offer.user.id?.let { api.avatarURL(it, 64) }, session.cookieHeader, offer.user.localizedLabel(), 64.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(offer.user.localizedLabel(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        offer.user.username?.let { Text(String.format(uiLocale, usernameHandleFormat, it), style = MaterialTheme.typography.bodySmall) }
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
                    IconButton(
                        onClick = onClose,
                        modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp),
                    ) { Icon(Icons.Default.Close, closeHostResult) }
                }
                offer.maxGuests?.let { Text(hostGuestCountLabel(it), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
                profile?.tagline?.takeIf { it.isNotBlank() }?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp)) }
                val lastActive = remember(context, profile?.lastActiveAtMillis) {
                    memberLastActiveLabel(context, profile?.lastActiveAtMillis)
                }
                val replyRate = profile?.replyRate?.takeIf(String::isNotBlank)
                if (lastActive != null || replyRate != null) {
                    Column(Modifier.padding(top = 8.dp).testTag("hostResultActivityFacts")) {
                        lastActive?.let {
                            Text(
                                stringResource(R.string.screen_host_result_last_active, it),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.testTag("hostResultLastActive"),
                            )
                        }
                        replyRate?.let {
                            Text(
                                stringResource(R.string.screen_host_result_reply_rate, it),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.testTag("hostResultReplyRate"),
                            )
                        }
                    }
                }
                val shared = profile?.circles.orEmpty().filter { it.id in sharedCircleIDs }
                if (shared.isNotEmpty()) Text(stringResource(R.string.screen_circles_in_common, shared.joinToString { it.label }), style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                offer.description?.let { Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), maxLines = 3, overflow = TextOverflow.Ellipsis) }
            }
        }
    }
}
