package org.trustroots.android.browser

import android.webkit.WebView
import androidx.webkit.WebViewFeature
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
class EmbeddedBrowserStyleOldProviderTest {
    @Test fun skipsDocumentStartRegistrationWhenThePlatformDoesNotSupportThatFeature() {
        val webView = WebView(RuntimeEnvironment.getApplication())
        try {
            assertFalse(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            installEmbeddedBrowserStyle(webView)
        } finally {
            webView.destroy()
        }
    }
}
