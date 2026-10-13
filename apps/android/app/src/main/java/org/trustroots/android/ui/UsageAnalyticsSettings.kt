package org.trustroots.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import org.trustroots.android.analytics.AndroidUsageAnalytics
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen

@Composable
internal fun UsageScreenTracking(analytics: UsageAnalytics, screen: UsageScreen?) {
    val enabled by analytics.enabled.collectAsState()
    LaunchedEffect(analytics, enabled, screen) {
        if (enabled && screen != null) analytics.screenViewed(screen)
    }
}

@Composable
internal fun UsageAnalyticsSettings(analytics: UsageAnalytics? = null) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val usage = analytics ?: remember { AndroidUsageAnalytics.get(context) }
    val enabled by usage.enabled.collectAsState()
    Column(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .toggleable(value = enabled, role = Role.Switch, onValueChange = usage::setEnabled),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Usage analytics",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f).padding(end = 16.dp),
            )
            Switch(checked = enabled, onCheckedChange = null)
        }
        Text(
            "Umami analytics, self-hosted by Trustroots.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(
            onClick = {
                uriHandler.openUri(SharedNavigationLinks.INFO_AND_SUPPORT.first { it.id == "privacy" }.url)
            },
            contentPadding = PaddingValues(horizontal = 0.dp),
        ) {
            Text("Privacy policy", style = MaterialTheme.typography.labelSmall)
        }
    }
}
