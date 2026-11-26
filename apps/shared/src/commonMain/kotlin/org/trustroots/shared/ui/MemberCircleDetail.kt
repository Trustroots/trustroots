package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class CircleDetailMember(
    val id: String,
    val memberId: String?,
    val username: String?,
    val name: String,
    val handle: String?,
)

class MemberCircleDetailState {
    internal var content by mutableStateOf(MemberCircleDetailContent())
        private set

    fun update(
        name: String,
        memberCount: String,
        description: String,
        contacts: List<CircleDetailMember>,
        recommenders: List<CircleDetailMember>,
        active: List<CircleDetailMember>,
        isLoading: Boolean,
        error: String?,
    ) {
        content = MemberCircleDetailContent(name, memberCount, description, contacts, recommenders, active, isLoading, error)
    }
}

internal data class MemberCircleDetailContent(
    val name: String = "",
    val memberCount: String = "",
    val description: String = "",
    val contacts: List<CircleDetailMember> = emptyList(),
    val recommenders: List<CircleDetailMember> = emptyList(),
    val active: List<CircleDetailMember> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
) {
    val hasMembers: Boolean
        get() = contacts.isNotEmpty() || recommenders.isNotEmpty() || active.isNotEmpty()
}

@Composable
internal fun MemberCircleDetail(
    state: MemberCircleDetailState,
    onBack: () -> Unit,
    onProfile: (String) -> Unit,
    onRetry: () -> Unit,
    onWiki: () -> Unit,
    artwork: @Composable (Modifier) -> Unit,
    avatar: @Composable (CircleDetailMember) -> Unit,
) {
    val content = state.content
    LazyColumn(
        Modifier.fillMaxSize().background(pilotPalette.background).testTag("circle-detail"),
        contentPadding = PaddingValues(bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item { CircleDetailSummary(content, onBack, artwork) }
        when {
            content.isLoading && !content.hasMembers -> item {
                PilotText("Finding circle members…", Modifier.padding(horizontal = 16.dp))
            }
            !content.hasMembers && content.error == null -> item {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PilotTitle("No members to show yet")
                    PilotText("Try again later to discover people in this circle.")
                }
            }
        }
        if (content.contacts.isNotEmpty()) item {
            CircleDetailMemberGroup(
                "Your contacts in this circle",
                "People you already know on Trustroots",
                content.contacts, onProfile, avatar,
            )
        }
        if (content.recommenders.isNotEmpty()) item {
            CircleDetailMemberGroup(
                "People who recommend you",
                "Members of this circle who left you a positive experience",
                content.recommenders, onProfile, avatar,
            )
        }
        if (content.active.isNotEmpty()) item {
            CircleDetailMemberGroup(
                "Other active members",
                "A small selection of members with current offers",
                content.active, onProfile, avatar,
            )
        }
        content.error?.let { error ->
            item {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (!content.hasMembers) PilotTitle("Circle members unavailable")
                    PilotError(error)
                    PilotButton("Try again", enabled = !content.isLoading, onClick = onRetry)
                }
            }
        }
        item {
            PilotButton(
                "Explore this community on the Trustroots Wiki",
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                onClick = onWiki,
            )
        }
    }
}

@Composable
private fun CircleDetailSummary(
    content: MemberCircleDetailContent,
    onBack: () -> Unit,
    artwork: @Composable (Modifier) -> Unit,
) {
    Box(Modifier.fillMaxWidth().height(300.dp)) {
        artwork(Modifier.matchParentSize())
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(
            Color.Black.copy(alpha = 0.28f), Color.Black.copy(alpha = 0.76f),
        ))))
        PilotButton("Back", modifier = Modifier.align(Alignment.TopStart).padding(start = 16.dp, top = 54.dp), onClick = onBack)
        Column(Modifier.align(Alignment.BottomStart).padding(20.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            BasicText(
                content.name,
                modifier = Modifier.semantics { heading() },
                style = TextStyle(color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold),
            )
            PilotText(content.memberCount, colour = Color.White, strong = true)
            if (content.description.isNotBlank()) {
                BasicText(
                    content.description,
                    style = TextStyle(color = Color.White, fontSize = 16.sp, lineHeight = 22.sp),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun CircleDetailMemberGroup(
    title: String,
    subtitle: String,
    members: List<CircleDetailMember>,
    onProfile: (String) -> Unit,
    avatar: @Composable (CircleDetailMember) -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp)
            .background(pilotPalette.surface, RoundedCornerShape(18.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PilotText(title, modifier = Modifier.semantics { heading() }, strong = true)
        PilotText(subtitle)
        members.forEach { member ->
            val action = member.username?.let { username ->
                Modifier.clickable(role = Role.Button) { onProfile(username) }
            } ?: Modifier
            Row(
                Modifier.fillMaxWidth().then(action).testTag("circle-detail-member-${member.id}").padding(vertical = 3.dp),
                horizontalArrangement = Arrangement.spacedBy(11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                avatar(member)
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    PilotText(member.name, strong = true)
                    member.handle?.let { PilotText(it) }
                }
            }
        }
    }
}
