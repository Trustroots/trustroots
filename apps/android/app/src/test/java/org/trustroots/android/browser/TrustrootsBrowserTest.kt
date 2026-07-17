package org.trustroots.android.browser

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrustrootsBrowserTest {
    @Test
    fun allowsTrustrootsHttpsPages() {
        assertTrue(isAllowedTrustrootsURL("https://www.trustroots.org/faq"))
        assertTrue(isAllowedTrustrootsURL("https://pr2777.test.trustroots.org/password/forgot"))
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
}
