package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class MemberProfileExperiencePerson(
    val id: String?,
    val username: String?,
    val name: String,
    val handle: String?,
)

data class MemberProfileExperienceFeedback(
    val person: MemberProfileExperiencePerson,
    val text: String?,
    val recommend: String?,
)

data class MemberProfileExperience(
    val id: String,
    val feedback: MemberProfileExperienceFeedback,
    val response: MemberProfileExperienceFeedback?,
    val met: Boolean,
    val hostedThem: Boolean,
    val hostedByThem: Boolean,
)

private const val PROFILE_EXPERIENCES_LIMIT = 6

@Composable
internal fun MemberProfileExperiences(
    experiences: List<MemberProfileExperience>,
    expanded: Boolean,
    onOpen: (String) -> Unit,
    onToggle: () -> Unit,
    modifier: Modifier,
    avatar: @Composable (MemberProfileExperiencePerson) -> Unit,
) {
    if (experiences.isEmpty()) return
    val visible = if (expanded) experiences else experiences.take(PROFILE_EXPERIENCES_LIMIT)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        PilotText("Experiences", Modifier.semantics { heading() }, strong = true)
        ExperienceSummary(experiences)
        visible.forEach { experience ->
            key(experience.id) {
                ExperienceCard(experience, onOpen, avatar)
            }
        }
        if (experiences.size > PROFILE_EXPERIENCES_LIMIT) {
            val label = if (expanded) "Show fewer" else "More experiences (${experiences.size - PROFILE_EXPERIENCES_LIMIT})"
            PilotButton(label, modifier = Modifier.fillMaxWidth(), onClick = onToggle)
        }
    }
}

@Composable
private fun ExperienceSummary(experiences: List<MemberProfileExperience>) {
    val total = experiences.size
    fun percentage(matches: (MemberProfileExperience) -> Boolean) = experiences.count(matches) * 100 / total
    Column(
        Modifier.fillMaxWidth().background(pilotPalette.surface, RoundedCornerShape(16.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PilotText(
            if (total == 1) "1 member shared an experience." else "$total members shared their experiences.",
            strong = true,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ExperienceStatistic("Recommend", percentage { it.feedback.recommend == "yes" }, Modifier.weight(1f))
            ExperienceStatistic("Met", percentage { it.met }, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ExperienceStatistic("Hosted them", percentage { it.hostedThem }, Modifier.weight(1f))
            ExperienceStatistic("Hosted by them", percentage { it.hostedByThem }, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ExperienceStatistic(label: String, percentage: Int, modifier: Modifier) {
    Column(modifier.background(pilotPalette.background, RoundedCornerShape(12.dp)).padding(9.dp)) {
        PilotText("$percentage%", strong = true)
        PilotText(label)
    }
}

@Composable
private fun ExperienceCard(
    experience: MemberProfileExperience,
    onOpen: (String) -> Unit,
    avatar: @Composable (MemberProfileExperiencePerson) -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().background(pilotPalette.surface, RoundedCornerShape(14.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ExperienceFeedback(experience.feedback, "Wrote about this member", "profile-experience-author-${experience.id}", onOpen, avatar)
        experience.response?.let { response ->
            Box(Modifier.fillMaxWidth().height(1.dp).background(pilotPalette.border))
            ExperienceFeedback(response, "Their response", "profile-experience-response-${experience.id}", onOpen, avatar)
        }
    }
}

@Composable
private fun ExperienceFeedback(
    feedback: MemberProfileExperienceFeedback,
    label: String,
    tag: String,
    onOpen: (String) -> Unit,
    avatar: @Composable (MemberProfileExperiencePerson) -> Unit,
) {
    val person = feedback.person
    val action = person.username?.let { username ->
        Modifier.clickable(role = Role.Button) { onOpen(username) }
    } ?: Modifier
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).then(action).testTag(tag),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            avatar(person)
            Column {
                PilotText(person.name, strong = true)
                person.handle?.let { PilotText(it) }
            }
        }
        PilotText(label)
        feedback.recommend?.let {
            val recommendation = when (it) {
                "yes" -> "Recommends"
                "no" -> "Does not recommend"
                else -> "Experience"
            }
            PilotText(recommendation, strong = it == "yes")
        }
        feedback.text?.let {
            BasicText(
                it,
                style = TextStyle(color = pilotPalette.ink, fontSize = 14.sp, lineHeight = 20.sp),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
