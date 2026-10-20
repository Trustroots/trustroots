package org.trustroots.android.ui.common

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.BubbleChart
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import org.trustroots.android.ui.Destination

@Composable
internal fun MemberNavigationBar(
    destination: Destination,
    unreadMessageCount: Int,
    avatarURL: java.net.URL?,
    sessionCookie: String?,
    memberLabel: String,
    onNavigate: (Destination) -> Unit,
) {
    NavigationBar(
        modifier = Modifier.shadow(elevation = 8.dp),
        containerColor = MaterialTheme.colorScheme.primary,
        tonalElevation = 0.dp,
    ) {
        Destination.entries.forEach { item ->
            NavigationBarItem(
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    selectedTextColor = MaterialTheme.colorScheme.onPrimary,
                    unselectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    unselectedTextColor = MaterialTheme.colorScheme.onPrimary,
                    indicatorColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.16f),
                ),
                selected = destination == item,
                label = { Text(item.label) },
                onClick = { onNavigate(item) },
                modifier = Modifier.testTag("navigation-${item.name.lowercase()}").semantics {
                    if (item == Destination.Messages) {
                        stateDescription = when (unreadMessageCount) {
                            0 -> "No unread conversations"
                            1 -> "1 unread conversation"
                            else -> "$unreadMessageCount unread conversations"
                        }
                    }
                },
                icon = {
                    BadgedBox(badge = {
                        if (item == Destination.Messages && unreadMessageCount > 0) Badge {
                            Text(if (unreadMessageCount > 99) "99+" else unreadMessageCount.toString())
                        }
                    }) {
                        when (item) {
                            Destination.Menu -> RemoteArtwork(
                                url = avatarURL,
                                sessionCookie = sessionCookie,
                                label = memberLabel,
                                size = 24.dp,
                            )
                            Destination.Circles -> Icon(
                                imageVector = Icons.Default.BubbleChart,
                                contentDescription = null,
                            )
                            Destination.Search -> Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                            )
                            Destination.Messages -> Icon(
                                imageVector = Icons.AutoMirrored.Filled.Chat,
                                contentDescription = null,
                            )
                        }
                    }
                },
            )
        }
    }
}
