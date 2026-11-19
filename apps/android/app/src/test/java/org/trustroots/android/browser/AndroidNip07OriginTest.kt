package org.trustroots.android.browser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidNip07OriginTest {
    @Test fun acceptsTheTrustedDomainsAndDefaultHttpsPort() {
        assertEquals("https://trustroots.org", trustedSigningOrigin("https://trustroots.org/circles/radio"))
        assertEquals("https://notes.hitchwiki.org", trustedSigningOrigin("https://NOTES.HITCHWIKI.ORG:443/"))
        assertEquals("https://hitchwiki.org", trustedSigningOrigin("https://hitchwiki.org/"))
    }

    @Test fun rejectsLookalikesAndNonstandardOrigins() {
        for (url in listOf(
            null, "about:blank", "https://nottrustroots.org", "https://trustroots.org.example.test",
            "https://trustroots.org@evil.test", "https://user@trustroots.org",
            "http://hitchwiki.org", "https://hitchwiki.org:8080",
        )) {
            assertNull(url, trustedSigningOrigin(url))
        }
    }

    @Test fun requiresATopLevelFrameMatchingTheCurrentPageOrigin() {
        val origin = "https://www.trustroots.org"
        assertTrue(maySignFromFrame(true, origin, "$origin/circles/radio"))
        assertFalse(maySignFromFrame(false, origin, "$origin/circles/radio"))
        assertFalse(maySignFromFrame(true, origin, "https://hitchwiki.org/"))
        assertFalse(maySignFromFrame(true, "https://example.test", "https://example.test/"))
    }
}
