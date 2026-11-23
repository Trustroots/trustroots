package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun MemberDashboard(
    accountKey: Any,
    loadNotes: suspend () -> Result<List<PilotNote>>,
    loadConnections: suspend () -> Result<PilotConnections>,
    renderConnectionsMap: @Composable (List<PilotMapPin>) -> Unit,
    onConnection: (String) -> Unit,
    showTitle: Boolean = true,
) {
    var notes by remember(accountKey) { mutableStateOf(emptyList<PilotNote>()) }
    var connections by remember(accountKey) { mutableStateOf(PilotConnections(emptyList(), emptyList())) }
    LaunchedEffect(accountKey) {
        loadNotes().onSuccess { notes = it }
    }
    LaunchedEffect(accountKey) {
        loadConnections().onSuccess { connections = it }
    }

    PilotForm(spacing = 8.dp) {
        if (showTitle) PilotTitle("Home")
        if (notes.isNotEmpty()) {
            PilotTitle("Trustroots updates")
            notes.forEach { note ->
                DashboardCard {
                    FeaturedNoteText(note.content)
                    PilotText(listOfNotNull(note.authorUsername, note.publishedAt.take(10)).joinToString(" · "))
                }
            }
        }
        if (connections.pins.isNotEmpty()) {
            PilotTitle("Connections on the map")
            PilotText("Approximate locations of people you know who are hosting or happy to meet.")
            renderConnectionsMap(connections.pins)
            // A text alternative also lets members open profiles without using map gestures.
            connections.pins.forEach { pin ->
                val availability = if (pin.hosting) "Hosting" else "Happy to meet"
                PilotButton("${pin.connection.name} · $availability") { onConnection(pin.connection.username) }
            }
        }
        if (connections.recent.isNotEmpty()) {
            PilotTitle("People you know who were active recently")
            connections.recent.forEach { member ->
                val activity = when (member.activity) {
                    "today" -> "Active today"
                    "week" -> "Active this week"
                    "month" -> "Active this month"
                    else -> null
                }
                PilotButton(listOfNotNull(member.name, activity).joinToString(" · ")) {
                    onConnection(member.username)
                }
            }
        }
    }
}

@Composable
private fun DashboardCard(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(pilotPalette.surface, RoundedCornerShape(12.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

private val noteLink = Regex("""\[([^\[\]\r\n]+)]\\?\(((?:\\[.:]|[^\s()\\])+)\\?\)""")

@Composable
private fun FeaturedNoteText(content: String) {
    val palette = pilotPalette
    val text = buildAnnotatedString {
        var end = 0
        noteLink.findAll(content).forEach { match ->
            if (content.getOrNull(match.range.first - 1) == '!') return@forEach
            val destination = match.groupValues[2].replace("\\.", ".").replace("\\:", ":")
            if (!destination.startsWith("https://", ignoreCase = true) &&
                !destination.startsWith("http://", ignoreCase = true)
            ) return@forEach
            append(content.substring(end, match.range.first))
            withLink(LinkAnnotation.Url(destination, TextLinkStyles(style = SpanStyle(color = palette.accent)))) {
                append(match.groupValues[1])
            }
            end = match.range.last + 1
        }
        append(content.substring(end))
    }
    BasicText(text, style = TextStyle(color = palette.ink, fontSize = 16.sp, lineHeight = 22.sp))
}
