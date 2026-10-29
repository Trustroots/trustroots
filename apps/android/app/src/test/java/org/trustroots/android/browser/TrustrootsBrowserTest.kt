package org.trustroots.android.browser

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrustrootsBrowserTest {
    @Test fun navigationConfirmationKeepsHostAndOriginalAddressTogether() {
        val url = "https://reader@EXAMPLE.test:8443/a%20b?view=compact#help"
        val link = requireNotNull(BrowserLink.parse(url))

        assertEquals(url, link.url)
        assertEquals("EXAMPLE.test", link.host)
        assertFalse(link.canEmbed)
    }

    @Test fun emptyAddressesDoNotProduceBrowserLinks() {
        assertNull(BrowserLink.parse(""))
        assertNull(BrowserLink.parse(" \t "))
    }

    @Test
    fun hidesWebsiteHeaderAndRemovesItsSpacing() {
        assertTrue(embeddedBrowserStyle.contains("#tr-header { display: none !important; }"))
        assertTrue(embeddedBrowserStyle.contains(".container-spacer { margin-top: 0 !important; }"))
        assertTrue(embeddedBrowserStyle.contains("location.hostname !== 'www.trustroots.org'"))
    }
    @Test
    fun allowsTrustrootsHttpsPages() {
        assertTrue(BrowserLink.parse("https://www.trustroots.org/faq")?.canEmbed == true)
        assertTrue(BrowserLink.parse("https://community.trustroots.org/password/forgot")?.canEmbed == true)
        assertTrue(BrowserLink.parse("https://trustroots.org/rules")?.canEmbed == true)
        assertTrue(BrowserLink.parse("https://wiki.hitchwiki.org/places")?.canEmbed == true)
    }

    @Test
    fun rejectsLookalikeAndInsecurePages() {
        assertFalse(BrowserLink.parse("https://trustroots.org.example.test/faq")?.canEmbed == true)
        assertFalse(BrowserLink.parse("http://www.trustroots.org/faq")?.canEmbed == true)
        assertFalse(BrowserLink.parse("javascript:alert(1)")?.canEmbed == true)
        assertFalse(BrowserLink.parse("not a url")?.canEmbed == true)
        assertFalse(BrowserLink.parse("https://hitchwiki.org.example.test")?.canEmbed == true)
    }

    @Test
    fun onlyOffersSafeHttpsExternalLinksToTheSystemBrowser() {
        assertNotNull(BrowserLink.parse("https://example.test/help"))
        assertNull(BrowserLink.parse("http://example.test/help"))
        assertNull(BrowserLink.parse("javascript:alert(1)"))
        assertNull(BrowserLink.parse("file:///data/local/tmp/secret"))
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

    @Test fun recognisesBareHitchwikiAndCaseInsensitiveHosts() {
        assertTrue(BrowserLink.parse("https://hitchwiki.org/")?.canEmbed == true)
        assertTrue(BrowserLink.parse("HTTPS://WWW.TRUSTROOTS.ORG/")?.canEmbed == true)
        assertFalse(BrowserLink.parse("https:///faq")?.canEmbed == true)
        assertFalse(BrowserLink.parse("/faq")?.canEmbed == true)
    }

    @Test fun malformedExternalUrlsAndCookieAttributesAreIgnored() {
        assertNull(BrowserLink.parse("not a valid URI"))
        assertNull(BrowserLink.parse("https:///faq"))
        assertNull(BrowserLink.parse("/faq"))
        assertEquals(
            listOf("session=fictional", "other=a=b"),
            cookiePairsForWebView(" ; Secure; HttpOnly; pAtH=/; dOmAiN=example.test; session=fictional; other=a=b"),
        )
        assertEquals(emptyList<String>(), cookiePairsForWebView(""))
    }
}
