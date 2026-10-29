package org.trustroots.android.browser

import android.webkit.ValueCallback
import android.webkit.WebView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class EmbeddedBrowserStyleAfterLoadTest {
    @Test
    fun appliesStyleOnTrustrootsPageWhenDocumentStartScriptsAreUnavailable() {
        val webView = RecordingWebView()
        try {
            applyEmbeddedBrowserStyleAfterLoad(
                webView,
                "https://www.trustroots.org/faq",
                documentStartSupported = false,
            )

            assertEquals(embeddedBrowserStyle, webView.script)
        } finally {
            webView.destroy()
        }
    }

    @Test
    fun skipsStyleForOtherUrlsOrWhenDocumentStartScriptsAreAvailable() {
        val webView = RecordingWebView()
        try {
            listOf<String?>(
                "https://community.trustroots.org/faq",
                "http://www.trustroots.org/faq",
                null,
            ).forEach { url ->
                applyEmbeddedBrowserStyleAfterLoad(webView, url, documentStartSupported = false)
            }
            applyEmbeddedBrowserStyleAfterLoad(
                webView,
                "https://www.trustroots.org/faq",
                documentStartSupported = true,
            )

            assertNull(webView.script)
        } finally {
            webView.destroy()
        }
    }

    private class RecordingWebView : WebView(RuntimeEnvironment.getApplication()) {
        var script: String? = null

        override fun evaluateJavascript(script: String, resultCallback: ValueCallback<String>?) {
            this.script = script
        }
    }
}
