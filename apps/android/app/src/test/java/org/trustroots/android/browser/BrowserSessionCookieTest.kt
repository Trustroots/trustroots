package org.trustroots.android.browser

import android.webkit.CookieManager
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class BrowserSessionCookieTest {
    @Test
    fun schemeRelativeTrustrootsRouteDefaultsCookieOriginToHttps() {
        val manager = CookieManager.getInstance()
        manager.removeAllCookies(null)

        applyBrowserSessionCookie(
            "//www.trustroots.org/profile",
            "connect.sid=fictional-session; Path=/",
        )
        manager.flush()

        assertTrue(
            manager.getCookie("https://www.trustroots.org/")
                .orEmpty()
                .contains("connect.sid=fictional-session"),
        )
    }
}
