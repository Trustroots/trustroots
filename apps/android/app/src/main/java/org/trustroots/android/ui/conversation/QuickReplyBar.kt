package org.trustroots.android.ui.conversation

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import org.trustroots.android.R
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp

@Composable
internal fun QuickReplyBar(
    onHostYes: () -> Unit,
    onHostNo: () -> Unit,
    onWriteBack: () -> Unit,
    enabled: Boolean,
) {
    val yesReply = stringResource(R.string.screen_quick_reply_host_yes)
    val noReply = stringResource(R.string.screen_quick_reply_host_no)
    val writeBack = stringResource(R.string.screen_quick_reply_write_back)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .testTag("quickReply"),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Button(onClick = onHostYes, enabled = enabled) { Text(yesReply) }
        Button(onClick = onHostNo, enabled = enabled) { Text(noReply) }
        TextButton(onClick = onWriteBack, enabled = enabled) { Text(writeBack) }
    }
}
