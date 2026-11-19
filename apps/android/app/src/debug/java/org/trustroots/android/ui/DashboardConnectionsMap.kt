package org.trustroots.android.ui

import android.graphics.Color
import android.view.ViewOutlineProvider
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.File
import kotlin.math.roundToInt
import org.osmdroid.config.Configuration
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.ui.hostmap.hostMapTiles
import org.trustroots.shared.ui.PilotMapPin

@Composable
internal fun DashboardConnectionsMap(pins: List<PilotMapPin>) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val tiles = remember { hostMapTiles(BuildConfig.MAPBOX_PUBLIC_TOKEN) }
    val map = remember(context, pins) {
        Configuration.getInstance().apply {
            osmdroidBasePath = File(context.filesDir, "maps").also { it.mkdirs() }
            osmdroidTileCache = File(context.filesDir, "map-tiles").also { it.mkdirs() }
            userAgentValue = "TrustrootsAndroid/${BuildConfig.VERSION_NAME} (+https://www.trustroots.org)"
            expirationOverrideDuration = 7L * 24 * 60 * 60 * 1000
        }
        MapView(context).apply {
            outlineProvider = ViewOutlineProvider.BOUNDS
            clipToOutline = true
            setDestroyMode(false)
            setTileSource(tiles.source)
            setMultiTouchControls(true)
            contentDescription = "Approximate locations of connections"

            val points = pins.map { pin ->
                val point = GeoPoint(pin.latitude, pin.longitude)
                overlays.add(Marker(this).apply {
                    position = point
                    title = pin.connection.name
                    snippet = context.getString(if (pin.hosting) R.string.screen_hosting else R.string.screen_meet)
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                    ContextCompat.getDrawable(context, org.osmdroid.library.R.drawable.marker_default)
                        ?.mutate()?.let { drawable ->
                            drawable.setTint(if (pin.hosting) Color.rgb(0, 130, 105) else Color.rgb(177, 106, 25))
                            icon = drawable
                        }
                })
                point
            }
            val distinctPoints = points.distinct()
            addOnFirstLayoutListener { _, _, _, _, _ ->
                if (distinctPoints.size == 1) {
                    controller.setZoom(9.0)
                    controller.setCenter(distinctPoints.first())
                } else if (distinctPoints.isNotEmpty()) {
                    val pinPadding = (56 * resources.displayMetrics.density).roundToInt()
                    zoomToBoundingBox(BoundingBox.fromGeoPoints(distinctPoints), false, pinPadding, 9.0, null)
                }
            }
        }
    }
    DisposableEffect(map, lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> map.onResume()
                Lifecycle.Event.ON_PAUSE -> map.onPause()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            map.onPause()
            map.onDetach()
        }
    }

    Column {
        androidx.compose.runtime.key(map) {
            AndroidView(
                factory = { map },
                modifier = Modifier.fillMaxWidth().height(260.dp).clipToBounds().testTag("pilot-connections-map"),
            )
        }
        Text(stringResource(tiles.attribution), style = MaterialTheme.typography.labelSmall)
    }
}
