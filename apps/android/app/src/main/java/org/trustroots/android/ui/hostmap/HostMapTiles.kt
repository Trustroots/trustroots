package org.trustroots.android.ui.hostmap

import androidx.annotation.StringRes
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.trustroots.android.R

/** Tile imagery and its attribution must always select the same provider. */
internal class HostMapTiles(val source: XYTileSource, @StringRes val attribution: Int)

internal fun hostMapTiles(mapboxToken: String): HostMapTiles = if (mapboxToken.isNotBlank()) {
    HostMapTiles(
        XYTileSource(
            "Mapbox Streets", 0, 19, 256, ".png?access_token=$mapboxToken",
            arrayOf("https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/"),
        ),
        R.string.screen_mapbox_attribution,
    )
} else {
    HostMapTiles(
        XYTileSource(
            "OpenStreetMap", 0, 19, 256, ".png",
            arrayOf("https://tile.openstreetmap.org/"),
        ),
        R.string.screen_openstreetmap_attribution,
    )
}
