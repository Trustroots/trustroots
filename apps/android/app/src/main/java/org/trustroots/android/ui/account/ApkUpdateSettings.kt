@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.account

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.trustroots.android.R

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
    Text(stringResource(R.string.screen_apk_updates), style = MaterialTheme.typography.titleMedium)
    Text(
        stringResource(R.string.screen_apk_updates_description),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 6.dp),
    )
    Button(onClick = onToggle, modifier = Modifier.padding(top = 12.dp)) {
        Text(stringResource(if (enabled) R.string.screen_turn_off_update_alerts else R.string.screen_turn_on_update_alerts))
    }
    if (enabled) {
        TextButton(onClick = onCheck, enabled = !checking) {
            Text(stringResource(if (checking) R.string.screen_checking_updates else R.string.screen_check_updates_now))
        }
    }
    status?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    releaseUrl?.let { url ->
        TextButton(onClick = { onOpenRelease(url) }) { Text(stringResource(R.string.screen_open_release_page)) }
    }
}
