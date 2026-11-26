package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private enum class MemberBottomTab(val key: String, val label: String) {
    Home("home", "Home"),
    Search("search", "Search"),
    Messages("messages", "Messages"),
    Menu("menu", "Menu"),
}

class MemberBottomNavigationState {
    internal var selectedKey by mutableStateOf(MemberBottomTab.Home.key)
        private set

    fun update(selectedKey: String) {
        this.selectedKey = selectedKey
    }
}

@Composable
internal fun MemberBottomNavigation(
    state: MemberBottomNavigationState,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    icon: @Composable (String) -> Unit,
) {
    val selectedBackground = Brush.verticalGradient(
        listOf(Color.Black.copy(alpha = 0.24f), Color.Black.copy(alpha = 0.10f)),
    )
    Row(
        modifier.fillMaxWidth().padding(start = 6.dp, end = 6.dp, top = 3.dp).selectableGroup(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MemberBottomTab.entries.forEach { tab ->
            val selected = state.selectedKey == tab.key
            Column(
                Modifier.weight(1f)
                    .defaultMinSize(minHeight = 44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .then(if (selected) Modifier.background(selectedBackground) else Modifier)
                    .selectable(selected = selected, role = Role.Button, onClick = { onSelect(tab.key) })
                    .testTag("ios-navigation-${tab.key}")
                    .padding(start = 4.dp, end = 4.dp, top = 3.dp, bottom = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                icon(tab.key)
                BasicText(
                    tab.label,
                    style = TextStyle(
                        color = Color.White,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    ),
                )
            }
        }
    }
}
