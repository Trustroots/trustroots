package org.trustroots.android.ui.hostmap

import org.junit.Assert.assertEquals
import org.junit.Test
import org.osmdroid.util.MapTileIndex
import org.trustroots.android.R

class HostMapTileSourceTest {
    @Test fun usesMapboxTilesAndIncludesTheConfiguredTokenInTileRequests() {
        val tiles = hostMapTiles("pk.fictional-map-token")
        val source = tiles.source

        assertEquals(R.string.screen_mapbox_attribution, tiles.attribution)
        assertEquals("Mapbox Streets", source.name())
        assertEquals(0, source.minimumZoomLevel)
        assertEquals(19, source.maximumZoomLevel)
        assertEquals(256, source.tileSizePixels)
        assertEquals(
            "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/7/41/63.png?access_token=pk.fictional-map-token",
            source.getTileURLString(MapTileIndex.getTileIndex(7, 41, 63)),
        )
    }

    @Test fun fallsBackToOpenStreetMapTilesWhenNoTokenIsConfigured() {
        val tiles = hostMapTiles("")
        val source = tiles.source

        assertEquals(R.string.screen_openstreetmap_attribution, tiles.attribution)
        assertEquals("OpenStreetMap", source.name())
        assertEquals(0, source.minimumZoomLevel)
        assertEquals(19, source.maximumZoomLevel)
        assertEquals(256, source.tileSizePixels)
        assertEquals(
            "https://tile.openstreetmap.org/7/41/63.png",
            source.getTileURLString(MapTileIndex.getTileIndex(7, 41, 63)),
        )
    }

    @Test fun whitespaceOnlyTokensUseOpenStreetMapImageryAndAttribution() {
        val tiles = hostMapTiles(" \t\n ")

        assertEquals("OpenStreetMap", tiles.source.name())
        assertEquals(R.string.screen_openstreetmap_attribution, tiles.attribution)
    }
}
