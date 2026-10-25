package org.trustroots.android.ui.profile

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.ui.common.NativeBackButton

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
    compactTitle: String? = null,
    isBlocked: Boolean? = false,
    safetyBusy: Boolean = false,
    onBlock: () -> Unit = {},
    onReport: () -> Unit = {},
) {
    var menuExpanded by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = topPadding)
            .padding(horizontalInset)
            .padding(horizontal = 4.dp, vertical = 4.dp)
            .testTag("profileActions"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NativeBackButton(
            onBack,
            modifier = Modifier.size(48.dp),
            tint = colorResource(R.color.artwork_on_scrim),
        )
        if (compactTitle == null) {
            Spacer(Modifier.weight(1f))
        } else {
            Text(
                compactTitle,
                modifier = Modifier.weight(1f).testTag("profileCompactTitle"),
                color = colorResource(R.color.artwork_on_scrim),
                style = MaterialTheme.typography.titleLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (isSelf) {
            TextButton(
                onClick = onEditProfile,
                modifier = Modifier.heightIn(min = 48.dp).testTag("profileEditAction"),
                colors = ButtonDefaults.textButtonColors(contentColor = colorResource(R.color.artwork_on_scrim)),
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.profile_edit_your_profile))
            }
        } else {
            if (isBlocked != true) Button(
                onClick = onMessage,
                enabled = !safetyBusy,
                modifier = Modifier.heightIn(min = 48.dp).testTag("profileMessageAction"),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            ) {
                Text(stringResource(R.string.profile_send_message))
            }
            Box {
                IconButton(
                    onClick = { menuExpanded = !menuExpanded },
                    modifier = Modifier.size(48.dp).testTag("profileActionsMenuButton"),
                ) {
                    Icon(
                        Icons.Filled.MoreVert,
                        contentDescription = stringResource(R.string.profile_more_actions),
                        tint = colorResource(R.color.artwork_on_scrim),
                    )
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    if (referencesEnabled) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.profile_share_experience)) },
                            onClick = { menuExpanded = false; onShareExperience() },
                            modifier = Modifier.testTag("profileShareExperienceAction"),
                        )
                    }
                    contactLabel?.let { label ->
                        DropdownMenuItem(
                            text = { Text(label) },
                            onClick = { menuExpanded = false; onContactAction() },
                            modifier = Modifier.testTag("profileContactAction"),
                        )
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.profile_report_member)) },
                        onClick = { menuExpanded = false; onReport() },
                        modifier = Modifier.testTag("profileReportAction"),
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(if (isBlocked == true) R.string.profile_unblock_member else R.string.profile_block_member)) },
                        enabled = isBlocked != null && !safetyBusy,
                        onClick = { menuExpanded = false; onBlock() },
                        modifier = Modifier.testTag("profileBlockAction"),
                    )
                }
            }
        }
    }
}
