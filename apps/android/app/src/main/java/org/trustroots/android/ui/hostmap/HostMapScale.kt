package org.trustroots.android.ui.hostmap

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.roundToInt
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView

internal data class HostMapScale(val metres: Double, val pixels: Float) {
    companion object {
        fun read(map: MapView): HostMapScale? {
            val maxPixels = minOf((100 * map.resources.displayMetrics.density).roundToInt(), map.width / 2)
            if (maxPixels == 0) return null

            val projection = map.projection
            val left = (map.width - maxPixels) / 2
            val y = map.height / 2
            val start = projection.fromPixels(left, y, null)
            val end = projection.fromPixels(left + maxPixels, y, null)
            val distance = GeoPoint(start).distanceToAsDouble(GeoPoint(end))
            if (!distance.isFinite() || distance <= 0) return null

            val magnitude = 10.0.pow(floor(log10(distance)))
            val metres = when {
                5 * magnitude <= distance -> 5 * magnitude
                2 * magnitude <= distance -> 2 * magnitude
                else -> minOf(magnitude, distance)
            }
            return HostMapScale(metres, (maxPixels * metres / distance).toFloat())
        }
    }
}

@Composable
internal fun HostMapScaleBar(scale: HostMapScale) {
    val width = with(LocalDensity.current) { scale.pixels.toDp() }
    val kilometres = scale.metres >= 1000
    val distance = if (kilometres) scale.metres / 1000 else scale.metres
    val unit = if (kilometres) "km" else "m"
    val locale = LocalConfiguration.current.locales[0]
    val value = NumberFormat.getNumberInstance(locale).format(distance)
    val colour = MaterialTheme.colorScheme.onSurface
    val shape = RoundedCornerShape(8.dp)

    Column(
        Modifier.testTag("hostMapScale")
            .shadow(3.dp, shape)
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.97f), shape)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "$value $unit",
            color = colour,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 2.dp),
        )
        Canvas(Modifier.width(width).height(5.dp)) {
            val stroke = 1.5.dp.toPx()
            val bottom = size.height - stroke / 2
            drawLine(colour, Offset(0f, bottom), Offset(size.width, bottom), stroke, StrokeCap.Round)
            drawLine(colour, Offset(stroke / 2, 0f), Offset(stroke / 2, bottom), stroke)
            drawLine(colour, Offset(size.width - stroke / 2, 0f), Offset(size.width - stroke / 2, bottom), stroke)
        }
    }
}
