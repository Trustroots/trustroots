package org.trustroots.android.browser

import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.webkit.WebViewFeature
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EmbeddedBrowserStyleTest {
    @Test fun hidesTrustrootsHeaderAtDocumentStart() {
        assumeTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val finished = CountDownLatch(1)
        val display = AtomicReference<String>()
        val webView = AtomicReference<WebView>()
        instrumentation.runOnMainSync {
            webView.set(WebView(instrumentation.targetContext).apply {
                settings.javaScriptEnabled = true
                installEmbeddedBrowserStyle(this)
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String?) {
                        view.evaluateJavascript("getComputedStyle(document.getElementById('tr-header')).display") {
                            display.set(it)
                            finished.countDown()
                        }
                    }
                }
                loadDataWithBaseURL(
                    "https://www.trustroots.org/faq",
                    "<html><head></head><body><header id='tr-header'>Trustroots</header></body></html>",
                    "text/html", "UTF-8", null,
                )
            })
        }
        try {
            assertTrue(finished.await(10, TimeUnit.SECONDS))
            assertEquals("\"none\"", display.get())
        } finally {
            instrumentation.runOnMainSync { webView.get()?.destroy() }
        }
    }
}
