package org.trustroots.android.ui

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Test
import org.trustroots.android.api.MobileApiException

class FailureMessageTest {
    @Test
    fun preservesApiFailureMessage() {
        val error = MobileApiException(503, "The service is unavailable.")

        assertEquals("The service is unavailable.", error.messageOr("Fallback"))
    }

    @Test
    fun preservesIoFailureMessage() {
        val error = IOException("Connection closed.")

        assertEquals("Connection closed.", error.messageOr("Fallback"))
    }

    @Test
    fun usesSpecificFallbackWhenMessageIsNull() {
        val error = IOException(null as String?)

        assertEquals("Could not load circles.", error.messageOr("Could not load circles."))
    }

    @Test
    fun preservesEmptyAndWhitespaceMessagesExactly() {
        assertEquals("", IOException("").messageOr("Fallback"))
        assertEquals("  \t ", IOException("  \t ").messageOr("Fallback"))
    }
}
