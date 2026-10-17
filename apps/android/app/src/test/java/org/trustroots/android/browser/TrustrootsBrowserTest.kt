package org.trustroots.android.browser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrustrootsBrowserTest {
    @Test
    fun hidesWebsiteHeaderAndRemovesItsSpacing() {
        assertTrue(embeddedBrowserStyle.contains("#tr-header { display: none !important; }"))
        assertTrue(embeddedBrowserStyle.contains(".container-spacer { margin-top: 0 !important; }"))
        assertTrue(embeddedBrowserStyle.contains("location.hostname !== 'www.trustroots.org'"))
    }
    @Test
    fun allowsTrustrootsHttpsPages() {
        assertTrue(isAllowedTrustrootsURL("https://www.trustroots.org/faq"))
        assertTrue(isAllowedTrustrootsURL("https://community.trustroots.org/password/forgot"))
        assertTrue(isAllowedTrustrootsURL("https://trustroots.org/rules"))
        assertTrue(isAllowedTrustrootsURL("https://wiki.hitchwiki.org/places"))
    }

    @Test
    fun rejectsLookalikeAndInsecurePages() {
        assertFalse(isAllowedTrustrootsURL("https://trustroots.org.example.test/faq"))
        assertFalse(isAllowedTrustrootsURL("http://www.trustroots.org/faq"))
        assertFalse(isAllowedTrustrootsURL("javascript:alert(1)"))
        assertFalse(isAllowedTrustrootsURL("not a url"))
        assertFalse(isAllowedTrustrootsURL("https://hitchwiki.org.example.test"))
    }

    @Test
    fun onlyOffersSafeHttpsExternalLinksToTheSystemBrowser() {
        assertTrue(isSafeExternalURL("https://example.test/help"))
        assertFalse(isSafeExternalURL("http://example.test/help"))
        assertFalse(isSafeExternalURL("javascript:alert(1)"))
        assertFalse(isSafeExternalURL("file:///data/local/tmp/secret"))
    }

    @Test
    fun extractsCookiePairsForWebViewInjection() {
        assertEquals(
            listOf("connect.sid=session-value"),
            cookiePairsForWebView("connect.sid=session-value"),
        )
        assertEquals(
            listOf("connect.sid=session-value", "other=1"),
            cookiePairsForWebView("connect.sid=session-value; other=1; Path=/"),
        )
    }

    @Test
    fun derivesCookieOriginAndDefaultsProtocolRelativeURLsToHttps() {
        assertEquals("https://example.test", browserCookieOrigin("//example.test/path"))
        assertEquals("http://example.test", browserCookieOrigin("http://example.test/path"))
        assertEquals("custom://example.test", browserCookieOrigin("custom://example.test/path"))
        assertEquals("https://example.test", browserCookieOrigin("https://user:pass@example.test/path"))
    }

    @Test
    fun rejectsCookieOriginForMalformedOrHostlessURLs() {
        assertEquals(null, browserCookieOrigin("not a valid URI"))
        assertEquals(null, browserCookieOrigin("/path"))
        assertEquals(null, browserCookieOrigin("https:///path"))
    }

    @Test fun recognisesBareHitchwikiAndCaseInsensitiveHosts() {
        assertTrue(isAllowedTrustrootsURL("https://hitchwiki.org/"))
        assertTrue(isAllowedTrustrootsURL("HTTPS://WWW.TRUSTROOTS.ORG/"))
        assertFalse(isAllowedTrustrootsURL("https:///faq"))
        assertFalse(isAllowedTrustrootsURL("/faq"))
    }

    @Test fun malformedExternalUrlsAndCookieAttributesAreIgnored() {
        assertFalse(isSafeExternalURL("not a valid URI"))
        assertFalse(isSafeExternalURL("https:///faq"))
        assertFalse(isSafeExternalURL("/faq"))
        assertEquals(
            listOf("session=fictional", "other=a=b"),
            cookiePairsForWebView(" ; Secure; HttpOnly; pAtH=/; dOmAiN=example.test; session=fictional; other=a=b"),
        )
        assertEquals(emptyList<String>(), cookiePairsForWebView(""))
    }
}
