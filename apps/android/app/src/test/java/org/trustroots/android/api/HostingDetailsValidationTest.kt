package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HostingDetailsValidationTest {
    @Test fun acceptsDefaultGuestCountWithUnknownDates() {
        assertNull(hostingDetailsValidationMessage("1", "", ""))
        assertNull(hostingDetailsValidationMessage("100", " 2028-02-29 ", " 2028-03-02 "))
    }

    @Test fun rejectsOutOfRangeGuestCountsAndIncompleteOrInvalidDates() {
        assertEquals("Enter the number of guests.", hostingDetailsValidationMessage("two", "", ""))
        assertEquals("Enter a guest count from 1 to 100.", hostingDetailsValidationMessage("0", "", ""))
        assertEquals("Enter a guest count from 1 to 100.", hostingDetailsValidationMessage("101", "", ""))
        assertEquals(
            "Enter both arrival and departure dates, or leave both blank.",
            hostingDetailsValidationMessage("2", "2027-05-01", ""),
        )
        assertEquals(
            "Enter both arrival and departure dates, or leave both blank.",
            hostingDetailsValidationMessage("2", "", "2027-05-04"),
        )
        assertEquals(
            "Enter dates in YYYY-MM-DD format.",
            hostingDetailsValidationMessage("2", "2027-5-01", "2027-05-04"),
        )
        assertEquals(
            "Enter dates in YYYY-MM-DD format.",
            hostingDetailsValidationMessage("2", "2027-05-01", "2027-5-04"),
        )
        assertEquals(
            "Enter dates in YYYY-MM-DD format.",
            hostingDetailsValidationMessage("2", "2027-02-29", "2027-03-04"),
        )
        assertEquals(
            "Enter dates in YYYY-MM-DD format.",
            hostingDetailsValidationMessage("2", "2027-05-01", "2027-05-32"),
        )
        assertEquals(
            "Departure must be after arrival.",
            hostingDetailsValidationMessage("2", "2027-05-04", "2027-05-01"),
        )
    }
}
