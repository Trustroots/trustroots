package org.trustroots.android.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class MobileApiPayloadEdgeCasesTest {
    @Test fun hostOfferUsesFallbackDescriptionAndCoercesStringGuestCount() {
        val offer = parseHostOffer(
            JSONObject(
                """{"_id":"offer-edge","status":"maybe","description":"  ","noOfferDescription":"A fictional unavailable date.","maxGuests":"3","user":{"id":"member-edge","username":"calm-lynx","displayName":"Calm Lynx"}}""",
            ),
        )

        assertEquals("offer-edge", offer.id)
        assertEquals("A fictional unavailable date.", offer.description)
        assertEquals(3, offer.maxGuests)
        assertEquals("member-edge", offer.user.id)
        assertEquals("Calm Lynx", offer.user.label)
    }

    @Test fun mapOfferParserDropsOverflowCoordinatesFromMixedFeatures() {
        val offers = parseMapOffers(
            JSONObject(
                """{"features":[{"properties":{"id":"overflow-feature"},"geometry":{"coordinates":[1e999,12.5]}},{"properties":{"id":"valid-feature"},"geometry":{"coordinates":[-45.25,12.5]}}]}""",
            ),
        )

        assertEquals(1, offers.size)
        assertEquals("valid-feature", offers.single().id)
        assertEquals(12.5, offers.single().latitude, 0.0001)
        assertEquals(-45.25, offers.single().longitude, 0.0001)
    }

    @Test fun contactRelationshipDefaultsUnexpectedBooleanAndMissingId() {
        val unexpectedBoolean = parseContactRelationship(
            JSONObject("""{"_id":"contact-edge","confirmed":"unrecognised"}"""),
        )
        val missingId = parseContactRelationship(JSONObject("""{"confirmed":"unrecognised"}"""))

        assertEquals("contact-edge", unexpectedBoolean.id)
        assertFalse(unexpectedBoolean.confirmed)
        assertNull(missingId.id)
        assertFalse(missingId.confirmed)
    }
}
