package org.trustroots.android.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApiExceptionTest {
    @Test fun missingAndWhitespaceOnlyServerDetailsAreAbsentAtTheErrorBoundary() {
        for (detail in listOf(null, "", " \t\n ")) {
            val error = MobileApiException(503, detail)

            assertNull(error.serverMessage)
            assertNull(error.message)
            assertFalse(error.isAuthenticationFailure)
        }
    }

    @Test fun nonblankDetailsPreserveTheirFormattingAndFailureIdentity() {
        val detail = "  A fictional validation response.  "
        val error = MobileApiException(401, detail, ApiFailureKind.REQUEST_REJECTED)

        assertEquals(detail, error.serverMessage)
        assertEquals(detail, error.message)
        assertEquals(401, error.statusCode)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, error.failureKind)
        assertTrue(error.isAuthenticationFailure)
    }
}
