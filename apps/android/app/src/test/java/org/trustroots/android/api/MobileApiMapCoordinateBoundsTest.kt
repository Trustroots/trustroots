package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileApiMapCoordinateBoundsTest {
    @Test fun keepsInclusiveWorldBoundsAndDropsMalformedOrOutOfRangeCoordinates() {
        val offers = parseMapOffers(
            JSONObject(
                """{"features":[
                    {"properties":{"id":"south-west"},"geometry":{"coordinates":[-180,-90]}},
                    {"properties":{"id":"north-east"},"geometry":{"coordinates":[180,90]}},
                    {"properties":{"id":"latitude-south"},"geometry":{"coordinates":[0,-90.01]}},
                    {"properties":{"id":"latitude-north"},"geometry":{"coordinates":[0,90.01]}},
                    {"properties":{"id":"longitude-west"},"geometry":{"coordinates":[-180.01,0]}},
                    {"properties":{"id":"longitude-east"},"geometry":{"coordinates":[180.01,0]}},
                    {"properties":{"id":"latitude-overflow"},"geometry":{"coordinates":[0,1e999]}},
                    {"properties":{"id":"empty-coordinates"},"geometry":{"coordinates":[]}},
                    {"properties":{"id":"short-coordinates"},"geometry":{"coordinates":[12]}},
                    {"properties":{"id":"extra-coordinate"},"geometry":{"coordinates":[12,34,56]}}
                ]}""",
            ),
        )

        assertEquals(listOf("south-west", "north-east"), offers.map { it.id })
        assertEquals(-90.0, offers.first().latitude, 0.0)
        assertEquals(-180.0, offers.first().longitude, 0.0)
        assertEquals(90.0, offers.last().latitude, 0.0)
        assertEquals(180.0, offers.last().longitude, 0.0)
    }
}
