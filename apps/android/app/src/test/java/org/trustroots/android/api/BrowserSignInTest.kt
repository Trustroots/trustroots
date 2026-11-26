package org.trustroots.android.api

import java.net.URI
import java.security.MessageDigest
import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BrowserSignInTest {
    private val code = "A".repeat(43)
    private val state = "B".repeat(43)
    private val path = "https://www.trustroots.org/mobile-auth/complete"

    @Test fun callbackOnlyAcceptsTheExactHttpsPathAndTwoTokenParameters() {
        val callback = requireNotNull(BrowserSignInCallback.parse("$path?state=$state&code=$code"))
        assertEquals(code, callback.code)
        assertEquals(state, callback.state)

        for (invalid in listOf(
            "",
            "https://[",
            "http://www.trustroots.org/mobile-auth/complete?code=$code&state=$state",
            "https://trustroots.org/mobile-auth/complete?code=$code&state=$state",
            "https://www.trustroots.org.evil.test/mobile-auth/complete?code=$code&state=$state",
            "https://account@www.trustroots.org/mobile-auth/complete?code=$code&state=$state",
            "https://www.trustroots.org:443/mobile-auth/complete?code=$code&state=$state",
            "https://www.trustroots.org/mobile-auth/./complete?code=$code&state=$state",
            "https://www.trustroots.org/mobile-auth/%63omplete?code=$code&state=$state",
            path,
            "$path?code=$code",
            "$path?code=$code&code=$code",
            "$path?state=$state&state=$state",
            "$path?code=$code&state=$state&redirect=https://elsewhere.test",
            "$path?code=$code&state=$state#",
            "$path?code=A&state=$state",
            "$path?code=$code&state=+",
            "$path?code=$code&state=${state.dropLast(1)}%42",
        )) {
            assertNull(invalid, BrowserSignInCallback.parse(invalid))
        }
    }

    @Test fun authorizationRequestUsesRandomUnsharedVerifierAndS256() {
        val first = BrowserSignInAttempt.create("https://www.trustroots.org/", nowMillis = 100)
        val second = BrowserSignInAttempt.create("https://www.trustroots.org", nowMillis = 100)
        val start = URI(first.startURL())
        val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
            MessageDigest.getInstance("SHA-256").digest(first.codeVerifier.toByteArray(Charsets.US_ASCII)),
        )

        assertEquals("www.trustroots.org", start.host)
        assertEquals("/auth/mobile/start", start.path)
        assertEquals("platform=android&code_challenge=$challenge&state=${first.state}", start.rawQuery)
        assertFalse(first.startURL().contains(first.codeVerifier))
        assertTrue(Regex("[A-Za-z0-9_-]{43}").matches(first.state))
        assertTrue(Regex("[A-Za-z0-9_-]{43}").matches(first.codeVerifier))
        assertNotEquals(first.state, second.state)
        assertNotEquals(first.codeVerifier, second.codeVerifier)
        assertEquals(300_100L, first.expiresAtMillis)
    }
}
