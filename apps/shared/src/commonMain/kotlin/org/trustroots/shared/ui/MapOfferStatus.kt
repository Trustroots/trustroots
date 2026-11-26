package org.trustroots.shared.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class MapOfferLegendMarker(val label: String, val argb: Long)

data class MapOfferStatusContent(
    val isLoading: Boolean,
    val countLabel: String?,
    val countMarkerArgb: Long,
    val legend: List<MapOfferLegendMarker>,
    val error: String?,
)

class MapOfferStatusState {
    internal var content by mutableStateOf<MapOfferStatusContent?>(null)
        private set

    fun update(content: MapOfferStatusContent) {
        this.content = content
    }
}

@Composable
internal fun MapOfferStatus(content: MapOfferStatusContent, modifier: Modifier = Modifier) {
    val palette = pilotPalette
    val surface = palette.surface.copy(alpha = 0.96f)
    Column(
        modifier.testTag("compose-map-result-overlay"),
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val status = if (content.isLoading) "Searching this area…" else content.countLabel
        if (status != null) {
            Row(
                Modifier.background(surface, CircleShape)
                    .padding(horizontal = 11.dp, vertical = 8.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (content.isLoading) {
                    MapSearchSpinner(palette.ink)
                } else {
                    Box(Modifier.size(9.dp).background(Color(content.countMarkerArgb), CircleShape))
                }
                BasicText(status, style = TextStyle(color = palette.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold))
            }
        }
        if (content.legend.isNotEmpty()) {
            FlowRow(
                Modifier.background(surface, RoundedCornerShape(16.dp))
                    .padding(horizontal = 10.dp, vertical = 7.dp)
                    .testTag("compose-map-marker-legend"),
                horizontalArrangement = Arrangement.spacedBy(9.dp, Alignment.End),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                content.legend.forEach { marker ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Box(Modifier.size(8.dp).background(Color(marker.argb), CircleShape))
                        BasicText(
                            marker.label,
                            style = TextStyle(color = palette.ink, fontSize = 11.sp, fontWeight = FontWeight.Medium),
                        )
                    }
                }
            }
        }
        content.error?.let { message ->
            BasicText(
                message,
                modifier = Modifier.background(palette.error, RoundedCornerShape(10.dp))
                    .padding(10.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
                style = TextStyle(color = palette.background, fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            )
        }
    }
}

@Composable
private fun MapSearchSpinner(colour: Color) {
    val transition = rememberInfiniteTransition(label = "map-search-progress")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "map-search-progress-angle",
    )
    Canvas(Modifier.size(13.dp)) {
        val width = 1.5.dp.toPx()
        drawArc(
            colour,
            startAngle = angle,
            sweepAngle = 250f,
            useCenter = false,
            topLeft = Offset(width / 2, width / 2),
            size = Size(size.width - width, size.height - width),
            style = Stroke(width, cap = StrokeCap.Round),
        )
    }
}
