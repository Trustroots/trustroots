package org.trustroots.android.browser

import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrowserMalformedExternalUrlJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun httpsLinksWithoutAValidHostAreBlockedWithoutOpeningTheExternalPrompt() {
        var closeCount = 0
        compose.setContent {
            TrustrootsBrowser(BrowserRoute("Local help", "about:blank"), { closeCount++ })
        }
        compose.onNodeWithText("Local help").assertExists()

        compose.runOnIdle {
            val browser = requireNotNull(findWebView(compose.activity.window.decorView))
            assertTrue(
                "HTTPS URL with no authority must be blocked",
                browser.webViewClient.shouldOverrideUrlLoading(browser, request("https:/help")),
            )
            assertTrue(
                "Malformed HTTPS URL must be blocked",
                browser.webViewClient.shouldOverrideUrlLoading(browser, request("https://[broken")),
            )
        }

        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        compose.runOnIdle { assertEquals(0, closeCount) }
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
