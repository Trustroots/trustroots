package org.trustroots.shared.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class CommunityNoteCardContent(val text: String, val attribution: String, val markerArgb: Long)

class CommunityNoteCardState {
    internal var content by mutableStateOf<CommunityNoteCardContent?>(null)
        private set

    fun update(content: CommunityNoteCardContent) {
        this.content = content
    }
}

@Composable
internal fun CommunityNoteCard(
    content: CommunityNoteCardContent,
    onDismiss: () -> Unit,
    icon: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = pilotPalette
    Row(
        modifier.fillMaxWidth()
            .background(palette.surface.copy(alpha = 0.97f), RoundedCornerShape(18.dp))
            .testTag("compose-selected-community-note")
            .padding(11.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier.size(36.dp).background(Color(content.markerArgb), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            icon()
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            BasicText(
                "Community Note",
                Modifier.semantics { heading() },
                style = TextStyle(color = palette.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold),
            )
            BasicText(
                content.text,
                style = TextStyle(color = palette.ink, fontSize = 15.sp, lineHeight = 20.sp),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
            )
            BasicText(
                content.attribution,
                style = TextStyle(color = palette.ink.copy(alpha = 0.8f), fontSize = 11.sp),
            )
        }
        Box(
            Modifier.size(44.dp)
                .clip(CircleShape)
                .clickable(role = Role.Button, onClick = onDismiss)
                .semantics { contentDescription = "Dismiss Community Note" }
                .testTag("dismiss-community-note"),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(Modifier.size(15.dp)) {
                val inset = 2.dp.toPx()
                val end = size.width - inset
                val stroke = 1.5.dp.toPx()
                drawLine(palette.ink, Offset(inset, inset), Offset(end, end), stroke, StrokeCap.Round)
                drawLine(palette.ink, Offset(end, inset), Offset(inset, end), stroke, StrokeCap.Round)
            }
        }
    }
}
