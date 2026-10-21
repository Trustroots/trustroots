package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HostingDetailsValidationTest {
    @Test fun acceptsDefaultGuestCountWithUnknownDates() {
        assertNull(hostingDetailsValidationMessage("1", "", ""))
    }

    @Test fun rejectsOutOfRangeGuestCountsAndIncompleteOrInvalidDates() {
        assertEquals("Enter a guest count from 1 to 100.", hostingDetailsValidationMessage("0", "", ""))
        assertEquals(
            "Enter both arrival and departure dates, or leave both blank.",
            hostingDetailsValidationMessage("2", "2027-05-01", ""),
        )
        assertEquals(
            "Enter dates in YYYY-MM-DD format.",
            hostingDetailsValidationMessage("2", "2027-02-29", "2027-03-04"),
        )
        assertEquals(
            "Departure must be after arrival.",
            hostingDetailsValidationMessage("2", "2027-05-04", "2027-05-01"),
        )
    }
}
