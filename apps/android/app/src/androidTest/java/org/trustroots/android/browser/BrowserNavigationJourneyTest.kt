package org.trustroots.android.browser

import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import android.content.Intent
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrowserNavigationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun externalNavigationRequiresConfirmationAndCanBeCancelled() {
        val opened = mutableListOf<Intent>()
        var closed = 0
        compose.setContent {
            val context = LocalContext.current
            CompositionLocalProvider(LocalContext provides object : ContextWrapper(context) {
                override fun startActivity(intent: Intent) { opened.add(intent) }
            }) {
                TrustrootsBrowser(BrowserRoute("Local help", "about:blank"), { closed++ })
            }
        }
        compose.onNodeWithText("Local help").assertExists()
        compose.runOnIdle {
            val web = requireNotNull(findWebView(compose.activity.window.decorView))
            assertTrue(web.settings.javaScriptEnabled)
            assertTrue(web.settings.domStorageEnabled)
            assertEquals(90, web.settings.textZoom)
            assertFalse(web.settings.allowFileAccess)
            assertFalse(web.settings.allowContentAccess)
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, web.settings.mixedContentMode)
            assertTrue(web.settings.userAgentString.endsWith(" TrustrootsAndroid/0.1 native"))
            assertFalse(web.webViewClient.shouldOverrideUrlLoading(web, request("https://www.trustroots.org/faq")))
            assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request("javascript:alert(1)")))
        }
        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        navigate("https://example.test/help")
        compose.onNodeWithText("example.test").assertExists()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        assertTrue(opened.isEmpty())

        navigate("https://example.test/guide")
        compose.onNodeWithText("Open").performClick()
        compose.runOnIdle {
            assertEquals(1, opened.size)
            assertEquals(Intent.ACTION_VIEW, opened.single().action)
            assertEquals("https://example.test/guide", opened.single().data.toString())
        }
        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        compose.onNodeWithContentDescription("Back").performClick()
        assertEquals(1, closed)
    }

    @Test fun closingBrowserRouteReleasesItsWebView() {
        val closed = java.util.concurrent.atomic.AtomicInteger()
        var browserVisible by mutableStateOf(true)
        compose.setContent {
            if (browserVisible) {
                TrustrootsBrowser(BrowserRoute("Local help", "about:blank"), {
                    closed.incrementAndGet()
                    browserVisible = false
                })
            } else {
                Text("Browser route closed")
            }
        }

        compose.waitUntil(10_000) {
            var present = false
            compose.runOnIdle { present = findWebView(compose.activity.window.decorView) != null }
            present
        }
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Browser route closed").assertExists()
        compose.runOnIdle {
            assertEquals(1, closed.get())
            assertEquals("Closing the route should remove its embedded WebView", null, findWebView(compose.activity.window.decorView))
        }
    }

    @Test fun sessionCookieInjectionIgnoresAttributesAndInvalidDestinations() {
        val origin = "https://browser-fixture.example.test"
        compose.runOnIdle {
            val manager = CookieManager.getInstance()
            try {
                applyBrowserSessionCookie(origin, "journey_session=fictional; Path=/; Domain=example.test; Secure; HttpOnly")
                val cookies = manager.getCookie(origin).orEmpty()
                assertTrue(cookies.contains("journey_session=fictional"))
                assertFalse(cookies.contains("Path="))
                assertFalse(cookies.contains("Domain="))
                for (header in listOf(null, "", " ")) applyBrowserSessionCookie(origin, header)
                applyBrowserSessionCookie("not a valid URI", "journey_session=changed")
                applyBrowserSessionCookie("/relative", "journey_session=changed")
                assertTrue(manager.getCookie(origin).orEmpty().contains("journey_session=fictional"))
            } finally {
                manager.setCookie(origin, "journey_session=; Max-Age=0; Path=/")
                manager.flush()
            }
        }
    }

    private fun navigate(url: String) = compose.runOnIdle {
        val web = requireNotNull(findWebView(compose.activity.window.decorView))
        assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request(url)))
    }

    private fun request(url: String) = object : WebResourceRequest {
        override fun getUrl(): Uri = Uri.parse(url)
        override fun isForMainFrame() = true
        override fun isRedirect() = false
        override fun hasGesture() = true
        override fun getMethod() = "GET"
        override fun getRequestHeaders(): Map<String, String> = emptyMap()
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }
}
