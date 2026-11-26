package org.trustroots.shared.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun MemberProfileHeader(
    name: String,
    handle: String?,
    tagline: String?,
    modifier: Modifier,
    avatar: @Composable () -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(
            Modifier.fillMaxWidth().testTag("profile-header-identity").semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            avatar()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                BasicText(name, style = TextStyle(color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold))
                handle?.let { PilotText(it, colour = Color.White.copy(alpha = 0.86f)) }
            }
        }
        tagline?.let {
            BasicText(
                it,
                modifier = Modifier.padding(start = 94.dp),
                style = TextStyle(color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
