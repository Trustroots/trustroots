package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MobileApiPartialAccommodationCoordinatesTest {
    @Test fun missingOrTruncatedLocationReturnsOnlyCoordinatesPresentInThePayload() {
        val noLocation = parseAccommodationOffer(JSONObject("{}"))
        val emptyLocation = parseAccommodationOffer(JSONObject("""{"location":[]}"""))
        val truncatedLocation = parseAccommodationOffer(JSONObject("""{"location":[51.5]}"""))

        assertEquals(
            AccommodationOffer(
                status = null,
                description = null,
                noOfferDescription = null,
                maxGuests = null,
            ),
            noLocation,
        )
        assertNull(noLocation.latitude)
        assertNull(noLocation.longitude)
        assertNull(emptyLocation.latitude)
        assertNull(emptyLocation.longitude)
        assertEquals(51.5, truncatedLocation.latitude!!, 0.0001)
        assertNull(truncatedLocation.longitude)
    }
}
