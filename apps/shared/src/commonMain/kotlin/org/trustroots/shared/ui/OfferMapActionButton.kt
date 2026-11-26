package org.trustroots.shared.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

enum class OfferMapAction(internal val label: String, internal val tag: String) {
    Filters("Search filters", "map-action-filters"),
    CurrentLocation("Use current location", "map-action-current-location"),
}

@Composable
internal fun OfferMapActionButton(
    action: OfferMapAction,
    surface: Color,
    onTap: () -> Unit,
    icon: @Composable () -> Unit,
) {
    Box(
        Modifier.size(44.dp)
            .shadow(3.dp, CircleShape, clip = false)
            .clip(CircleShape)
            .background(surface)
            .clickable(role = Role.Button, onClick = onTap)
            .semantics { contentDescription = action.label }
            .testTag(action.tag),
        contentAlignment = Alignment.Center,
    ) {
        icon()
    }
}
