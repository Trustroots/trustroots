package org.trustroots.android.ui.account

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
internal fun ApkUpdateSettings(
    enabled: Boolean,
    checking: Boolean,
    status: String?,
    releaseUrl: String?,
    onToggle: () -> Unit,
    onCheck: () -> Unit,
    onOpenRelease: (String) -> Unit,
) {
    Text("APK updates", style = MaterialTheme.typography.titleMedium)
    Text(
        "Receive an alert when a new signed Android preview is available on GitHub.",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 6.dp),
    )
    Button(onClick = onToggle, modifier = Modifier.padding(top = 12.dp)) {
        Text(if (enabled) "Turn off update alerts" else "Turn on update alerts")
    }
    if (enabled) {
        TextButton(onClick = onCheck, enabled = !checking) {
            Text(if (checking) "Checking for updates…" else "Check for updates now")
        }
    }
    status?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    releaseUrl?.let { url ->
        TextButton(onClick = { onOpenRelease(url) }) { Text("Open release page") }
    }
}
