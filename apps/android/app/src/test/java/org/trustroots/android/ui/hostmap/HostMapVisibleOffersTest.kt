package org.trustroots.android.ui.hostmap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.MapOffer

class HostMapVisibleOffersTest {
    @Test fun newMapUsesSixMonthActivityDefault() {
        assertEquals(6, HostMapFilters().seenMonths)
        assertEquals(6, HostMapUiState().filters.seenMonths)
    }

    @Test fun resultsAwaitMeasuredBoundsAndExcludeCachedPinsOutsideTheCurrentArea() {
        val inside = MapOffer("inside", 10.0, 20.0)
        val edge = MapOffer("edge", 0.0, 30.0)
        val north = MapOffer("north", 21.0, 20.0)
        val south = MapOffer("south", -1.0, 20.0)
        val west = MapOffer("west", 10.0, 9.0)
        val east = MapOffer("east", 10.0, 31.0)
        val offers = listOf(inside, edge, north, south, west, east)

        assertTrue(visibleMapOffers(offers, null).isEmpty())
        assertEquals(listOf(inside, edge), visibleMapOffers(offers, MapBounds(0.0, 10.0, 20.0, 30.0)))
        assertTrue(visibleMapOffers(emptyList(), MapBounds(0.0, 10.0, 20.0, 30.0)).isEmpty())
    }

    @Test fun aDatelineCrossingAreaIncludesBothSidesButStillExcludesLatitudesOutsideIt() {
        val east = MapOffer("east", 0.0, 175.0)
        val west = MapOffer("west", 0.0, -175.0)
        val outside = MapOffer("outside", 0.0, 0.0)
        val north = MapOffer("north", 20.0, -175.0)
        assertEquals(
            listOf(east, west),
            visibleMapOffers(listOf(east, west, outside, north), MapBounds(-10.0, 170.0, 10.0, -170.0)),
        )
    }
}
