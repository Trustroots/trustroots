package org.trustroots.android.ui.profile

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage

@Composable
internal fun ProfileSafetyNotice(
    displayName: String,
    state: MemberProfileUiState,
    onRetry: () -> Unit,
) {
    if (state.isLoadingBlock || state.isBlocked == true || (state.isBlocked == null && state.blockFailure != null)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
            if (state.isLoadingBlock) {
                CircularProgressIndicator(Modifier.size(20.dp))
                Text(stringResource(R.string.profile_block_checking))
            }
            if (state.isBlocked == true) {
                Text(stringResource(R.string.profile_blocked_notice, displayName), modifier = Modifier.testTag("profileBlockedNotice"))
            } else if (state.blockFailure != null) {
                Text(
                    safetyFailureMessage(requireNotNull(state.blockFailure), R.string.profile_block_load_error),
                    color = MaterialTheme.colorScheme.error,
                )
                TextButton(onClick = onRetry, enabled = !state.isLoadingBlock) {
                    Text(stringResource(R.string.retry))
                }
            }
        }
    }
}

@Composable
internal fun ProfileBlockDialog(
    displayName: String,
    blocked: Boolean,
    state: MemberProfileUiState,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!state.isUpdatingBlock) onDismiss() },
        title = { Text(stringResource(if (blocked) R.string.profile_block_confirm_title else R.string.profile_unblock_confirm_title)) },
        text = {
            Column {
                Text(stringResource(if (blocked) R.string.profile_block_confirm_message else R.string.profile_unblock_confirm_message, displayName))
                state.blockFailure?.let {
                    Text(safetyFailureMessage(it, R.string.profile_block_update_error), color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !state.isUpdatingBlock, modifier = Modifier.testTag("confirmProfileBlock")) {
                Text(stringResource(when {
                    state.isUpdatingBlock -> R.string.profile_block_pending
                    blocked -> R.string.profile_block_member
                    else -> R.string.profile_unblock_member
                }))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !state.isUpdatingBlock) { Text(stringResource(R.string.profile_cancel)) }
        },
    )
}

@Composable
internal fun ProfileReportDialog(
    displayName: String,
    state: MemberProfileUiState,
    onDismiss: () -> Unit,
    onDraftChanged: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!state.isSubmittingReport) onDismiss() },
        title = { Text(stringResource(if (state.reportSubmitted) R.string.profile_report_sent else R.string.profile_report_member)) },
        text = {
            Column(Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState())) {
                if (state.reportSubmitted) {
                    Text(stringResource(R.string.profile_report_thanks))
                } else {
                    Text(stringResource(R.string.profile_report_target, displayName))
                    Text(stringResource(R.string.profile_report_help), modifier = Modifier.padding(vertical = 8.dp))
                    TextField(
                        value = state.reportDraft,
                        onValueChange = onDraftChanged,
                        enabled = !state.isSubmittingReport,
                        label = { Text(stringResource(R.string.profile_report_details)) },
                        minLines = 4,
                        modifier = Modifier.fillMaxWidth().testTag("profileReportDetails"),
                    )
                    state.reportFailure?.let {
                        Text(safetyFailureMessage(it, R.string.profile_report_error), color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        },
        confirmButton = {
            if (state.reportSubmitted) {
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.profile_safety_done)) }
            } else {
                TextButton(
                    onClick = onSubmit,
                    enabled = state.reportDraft.isNotBlank() && !state.isSubmittingReport,
                    modifier = Modifier.testTag("submitProfileReport"),
                ) {
                    Text(stringResource(if (state.isSubmittingReport) R.string.profile_report_sending else R.string.profile_report_send))
                }
            }
        },
        dismissButton = {
            if (!state.reportSubmitted) {
                TextButton(onClick = onDismiss, enabled = !state.isSubmittingReport) { Text(stringResource(R.string.profile_cancel)) }
            }
        },
    )
}

@Composable
private fun safetyFailureMessage(failure: MemberProfileFailure, fallback: Int): String =
    if (!failure.serverMessage.isNullOrBlank() || failure.apiKind != null) {
        resolveFailureMessage(UiFailure(failure.serverMessage, failure.apiKind, UiFailureFallback.REACH_TRUSTROOTS))
    } else stringResource(fallback)
