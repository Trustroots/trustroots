package org.trustroots.android.api

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class MobileApiHostOfferValidationTest {
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val api = MobileApiClient("http://127.0.0.1:1")

    @Test fun rejectsUnknownStatusesAndGuestCountsOutsideTheSupportedRange() {
        listOf(
            "unknown host status" to update(status = "available"),
            "negative guests" to update(maxGuests = -1),
            "more than ninety-nine guests" to update(maxGuests = 100),
            "unknown meeting status" to update(meetingStatus = "available"),
        ).forEach { (case, hostOffer) ->
            assertValidationFailure(case, hostOffer)
        }
    }

    @Test fun rejectsCoordinatesOutsideTheirRangesAndNonFiniteValues() {
        listOf(
            "latitude below -90" to update(latitude = -90.0001),
            "latitude above 90" to update(latitude = 90.0001),
            "NaN latitude" to update(latitude = Double.NaN),
            "longitude below -180" to update(longitude = -180.0001),
            "longitude above 180" to update(longitude = 180.0001),
            "NaN longitude" to update(longitude = Double.NaN),
            "web map placeholder" to update(latitude = 48.6908333333, longitude = 9.14055555556),
        ).forEach { (case, hostOffer) ->
            assertValidationFailure(case, hostOffer)
        }
    }

    private fun assertValidationFailure(case: String, hostOffer: HostOfferUpdate) {
        val result = runBlocking { api.saveHostOffer(session, hostOffer) }
        val error = result.exceptionOrNull()

        assertFalse("$case should fail", result.isSuccess)
        assertEquals(
            "$case must fail validation with IllegalArgumentException before any network I/O, got $error",
            IllegalArgumentException::class.java,
            error?.javaClass,
        )
    }

    private fun update(
        status: String = "yes",
        maxGuests: Int = 2,
        meetingStatus: String = "not-set",
        latitude: Double = 51.5,
        longitude: Double = -0.12,
    ) = HostOfferUpdate(
        status = status,
        description = "A quiet place to rest.",
        noOfferDescription = "Away this week.",
        maxGuests = maxGuests,
        meetingStatus = meetingStatus,
        showOnlyInMyCircles = false,
        latitude = latitude,
        longitude = longitude,
    )
}
