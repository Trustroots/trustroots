package org.trustroots.android.ui

import java.io.IOException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.trustroots.android.api.MobileApiException

class AuthenticationFailuresTest {
    @Test fun onlyDirectUnauthorizedApiFailuresInvalidateTheSession() {
        assertTrue(MobileApiException(401, "Fictional session expired").isAuthenticationFailure())
        assertFalse(MobileApiException(403, "Fictional access denied").isAuthenticationFailure())
        assertFalse(MobileApiException(500, "Fictional server failure").isAuthenticationFailure())
        assertFalse(IOException("Fictional connection reset").isAuthenticationFailure())
        assertFalse(IllegalStateException("Fictional parsing failure").isAuthenticationFailure())
        assertFalse(
            IllegalStateException(
                "Fictional wrapped failure",
                MobileApiException(401, "Fictional nested session expiry"),
            ).isAuthenticationFailure(),
        )
    }
}
