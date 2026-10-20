package org.trustroots.android.ui

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.toUiFailure

class FailureMessageTest {
    @Test
    fun retainsOnlyNonblankServerTextAndApiFailureKind() {
        val serverError = MobileApiException(
            statusCode = 503,
            serverMessage = "A fictional service message.",
            failureKind = ApiFailureKind.REQUEST_REJECTED,
        ).toUiFailure(UiFailureFallback.LOAD_CONTACTS)
        val blankServerError = MobileApiException(
            statusCode = 503,
            serverMessage = "  \t",
            failureKind = ApiFailureKind.REQUEST_REJECTED,
        ).toUiFailure(UiFailureFallback.LOAD_CONTACTS)

        assertEquals("A fictional service message.", serverError.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, serverError.apiKind)
        assertNull(blankServerError.serverMessage)
        assertEquals(ApiFailureKind.REQUEST_REJECTED, blankServerError.apiKind)
    }

    @Test
    fun unknownExceptionKeepsScreenFallbackIdentityAndDoesNotExposePlatformText() {
        val failure = IOException("English transport diagnostic").toUiFailure(UiFailureFallback.LOAD_CONTACTS)

        assertEquals(UiFailure(fallback = UiFailureFallback.LOAD_CONTACTS), failure)
    }

    @Test
    fun fallbackStateDoesNotStoreResolvedLocaleText() {
        val failure = IOException("An old translated message").toUiFailure(UiFailureFallback.REACH_TRUSTROOTS)

        assertNull(failure.serverMessage)
        assertNull(failure.apiKind)
        assertEquals(UiFailureFallback.REACH_TRUSTROOTS, failure.fallback)
    }
}
