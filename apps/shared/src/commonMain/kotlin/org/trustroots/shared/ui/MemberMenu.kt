package org.trustroots.shared.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.trustroots.shared.ui.icons.TrustrootsLogo

enum class MemberMenuAction(internal val label: String, internal val tag: String) {
    Profile("My profile", "profile-menu-entry"),
    Circles("Circles", "circles-menu-entry"),
    Contacts("Contacts", "contacts-menu-entry"),
    FindMembers("Find members", "member-search-menu-entry"),
    Account("Account", "account-menu-entry"),
    Faq("Frequently asked questions", "faq-menu-entry"),
    Support("Contact and support", "support-menu-entry"),
    About("About", "about-menu-entry"),
    Privacy("Privacy", "privacy-menu-entry"),
    Rules("Rules", "rules-menu-entry"),
    Statistics("Statistics", "statistics-menu-entry"),
}

private val memberActions = listOf(
    MemberMenuAction.Profile, MemberMenuAction.Circles, MemberMenuAction.Contacts,
    MemberMenuAction.FindMembers, MemberMenuAction.Account,
)
private val helpActions = listOf(MemberMenuAction.Faq, MemberMenuAction.Support)
private val siteActions = listOf(
    MemberMenuAction.About, MemberMenuAction.Privacy, MemberMenuAction.Rules, MemberMenuAction.Statistics,
)

@Composable
internal fun MemberMenu(buildInfo: String, onSelect: (MemberMenuAction) -> Unit) {
    val palette = pilotPalette
    PilotForm {
        PilotTitle("Menu")
        MenuSection(memberActions, onSelect)
        PilotText("Help", strong = true)
        MenuSection(helpActions, onSelect)
        PilotText("Trustroots", strong = true)
        MenuSection(siteActions, onSelect)

        Column(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Image(
                imageVector = TrustrootsLogo,
                contentDescription = "Trustroots",
                modifier = Modifier.size(70.dp),
                colorFilter = if (isSystemInDarkTheme()) ColorFilter.tint(palette.ink) else null,
            )
            PilotText("Travellers’ community", strong = true)
            BasicText(
                "Sharing, hosting and getting people together.",
                style = TextStyle(color = palette.ink, fontSize = 13.sp, textAlign = TextAlign.Center),
            )
            BasicText(
                buildInfo,
                style = TextStyle(color = palette.ink, fontSize = 10.sp, fontFamily = FontFamily.Monospace),
            )
        }
    }
}

@Composable
private fun MenuSection(actions: List<MemberMenuAction>, onSelect: (MemberMenuAction) -> Unit) {
    val palette = pilotPalette
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(palette.surface)) {
        actions.forEachIndexed { index, action ->
            if (index > 0) {
                Box(
                    Modifier.fillMaxWidth().padding(horizontal = 14.dp)
                        .height(1.dp).background(palette.border.copy(alpha = 0.25f)),
                )
            }
            Row(
                Modifier.fillMaxWidth().defaultMinSize(minHeight = 44.dp)
                    .clickable(role = Role.Button) { onSelect(action) }
                    .testTag(action.tag)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PilotText(action.label)
            }
        }
    }
}
