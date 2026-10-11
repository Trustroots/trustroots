package org.trustroots.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
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
    val usage = analytics ?: remember { AndroidUsageAnalytics.get(context) }
    val enabled by usage.enabled.collectAsState()
    Text("Usage analytics", style = MaterialTheme.typography.titleMedium)
    Text(
        "Optional: share app opens and screen views with Trustroots’ self-hosted Umami at " +
            "1p.trustroots.org. No account details, messages, search terms or device identifiers " +
            "are sent. The service receives your IP address when you connect. " +
            "Off by default; you can turn it off here at any time.",
    )
    TextButton(onClick = { usage.setEnabled(!enabled) }) {
        Text(if (enabled) "Turn off usage analytics" else "Turn on usage analytics")
    }
}
