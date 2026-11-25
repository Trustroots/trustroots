package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class MemberCircle(
    val id: String,
    val name: String,
    val description: String,
    val memberCount: String,
    val isMember: Boolean,
)

class MemberCirclesState {
    internal var content by mutableStateOf(MemberCirclesContent())
        private set

    fun update(circles: List<MemberCircle>, isLoading: Boolean, updatingCircleId: String?, error: String?) {
        content = MemberCirclesContent(circles, isLoading, updatingCircleId, error)
    }
}

internal data class MemberCirclesContent(
    val circles: List<MemberCircle> = emptyList(),
    val isLoading: Boolean = true,
    val updatingCircleId: String? = null,
    val error: String? = null,
)

@Composable
internal fun MemberCircles(
    state: MemberCirclesState,
    onOpen: (String) -> Unit,
    onMembership: (String) -> Unit,
    onRetry: () -> Unit,
    onWiki: () -> Unit,
    artwork: @Composable (MemberCircle) -> Unit,
) {
    val content = state.content
    val palette = pilotPalette
    val focus = LocalFocusManager.current
    var filter by remember { mutableStateOf("") }
    val query = filter.trim()
    val circles = remember(content.circles, query) {
        val matching = content.circles.filter { circle ->
            query.isEmpty() || "${circle.name} ${circle.description}".contains(query, ignoreCase = true)
        }
        val (joined, available) = matching.partition { it.isMember }
        joined + available
    }

    Column(Modifier.fillMaxSize().background(palette.background)) {
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            when {
                content.isLoading && content.circles.isEmpty() -> item { PilotText("Loading circles…") }
                content.error != null -> item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PilotTitle("Circles unavailable")
                        PilotError(content.error)
                        PilotButton("Try again", onClick = onRetry)
                    }
                }
                else -> {
                    if (circles.isEmpty()) item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (query.isEmpty()) {
                                PilotTitle("No circles available")
                                PilotText("Circles will appear here when they are available.")
                            } else {
                                PilotTitle("No matching circles")
                                PilotText("Try another circle name or description.")
                                PilotButton("Clear filter") { filter = "" }
                            }
                        }
                    }
                    items(circles, key = { it.id }) { circle ->
                        MemberCircleRow(
                            circle = circle,
                            isUpdating = content.updatingCircleId == circle.id,
                            membershipEnabled = content.updatingCircleId == null && !content.isLoading,
                            onOpen = {
                                focus.clearFocus()
                                onOpen(circle.id)
                            },
                            onMembership = { onMembership(circle.id) },
                            artwork = { artwork(circle) },
                        )
                    }
                    item {
                        PilotButton("Open the Trustroots Wiki", modifier = Modifier.fillMaxWidth()) {
                            focus.clearFocus()
                            onWiki()
                        }
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)) {
            PilotInput("Filter circles", filter, "circles-filter", enabled = true) { filter = it }
        }
    }
}

@Composable
private fun MemberCircleRow(
    circle: MemberCircle,
    isUpdating: Boolean,
    membershipEnabled: Boolean,
    onOpen: () -> Unit,
    onMembership: () -> Unit,
    artwork: @Composable () -> Unit,
) {
    val palette = pilotPalette
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.surface)
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier.weight(1f).clickable(role = Role.Button, onClick = onOpen)
                .testTag("circle-${circle.id}"),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            artwork()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BasicText(
                    circle.name,
                    style = TextStyle(color = palette.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (circle.description.isNotBlank()) BasicText(
                    circle.description,
                    style = TextStyle(color = palette.ink, fontSize = 14.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                BasicText(circle.memberCount, style = TextStyle(color = palette.ink, fontSize = 12.sp))
            }
        }
        val membershipLabel = when {
            isUpdating -> "Updating…"
            circle.isMember -> "Joined"
            else -> "Join"
        }
        PilotButton(
            membershipLabel,
            enabled = membershipEnabled,
            modifier = Modifier.testTag("circle-membership-${circle.id}"),
            onClick = onMembership,
        )
    }
}
