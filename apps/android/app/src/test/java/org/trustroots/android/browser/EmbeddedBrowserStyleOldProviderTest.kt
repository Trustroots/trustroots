package org.trustroots.android.browser

import android.webkit.WebView
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.trustroots.android.nostr.AndroidNostrKeys
import org.trustroots.android.nostr.nostrAccountScope

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

    @Test fun leavesNostrSigningUnavailableOnAnOlderWebViewProvider() {
        val context = RuntimeEnvironment.getApplication()
        val webView = WebView(context)
        val scope = CoroutineScope(Dispatchers.Unconfined)
        try {
            assertFalse(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            val keys = AndroidNostrKeys(context, nostrAccountScope("https://example.test", "legacy-browser"))
            AndroidNip07Bridge(BrowserNostrSession(keys) { true }, scope).install(webView)
        } finally {
            scope.cancel()
            webView.destroy()
        }
    }

    @Test
    @Config(
        instrumentedPackages = ["androidx.webkit"],
        shadows = [ShadowMessageListenerOnly::class],
    )
    fun leavesNostrSigningUnavailableWhenOnlyWebMessagesAreSupported() {
        val context = RuntimeEnvironment.getApplication()
        val webView = WebView(context)
        val scope = CoroutineScope(Dispatchers.Unconfined)
        try {
            assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
            assertFalse(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            val keys = AndroidNostrKeys(context, nostrAccountScope("https://example.test", "partial-browser"))
            AndroidNip07Bridge(BrowserNostrSession(keys) { true }, scope).install(webView)
        } finally {
            scope.cancel()
            webView.destroy()
        }
    }

    @Implements(WebViewFeature::class, isInAndroidSdk = false)
    class ShadowMessageListenerOnly {
        companion object {
            @JvmStatic
            @Implementation
            fun isFeatureSupported(feature: String): Boolean =
                feature == WebViewFeature.WEB_MESSAGE_LISTENER
        }
    }
}
