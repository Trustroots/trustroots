package org.trustroots.android.ui.profile

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Surface
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.horizontalInset

/** Matches `config.featureFlags.reference` (enabled in production and development). */
internal const val referencesEnabled = true

@Composable
internal fun ProfileActionBar(
    isSelf: Boolean,
    onBack: () -> Unit,
    onEditProfile: () -> Unit,
    onMessage: () -> Unit,
    onShareExperience: () -> Unit,
    contactLabel: String?,
    onContactAction: () -> Unit,
    topPadding: Dp,
    horizontalInset: PaddingValues,
) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth().testTag("profileActions"),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(top = topPadding)
                .padding(horizontalInset)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            NativeBackButton(onBack)
            if (isSelf) {
                TextButton(onClick = onEditProfile) { Text("Edit your profile") }
            } else {
                TextButton(onClick = onMessage) { Text("Send a message") }
                if (referencesEnabled) {
                    TextButton(onClick = onShareExperience) { Text("Share your experience") }
                }
                contactLabel?.let { label ->
                    TextButton(onClick = onContactAction) { Text(label) }
                }
            }
        }
    }
}
