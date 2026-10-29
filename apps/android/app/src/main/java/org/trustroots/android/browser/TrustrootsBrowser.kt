package org.trustroots.android.browser

import org.trustroots.android.R
import androidx.compose.ui.res.stringResource

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import java.net.URI
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.bottomInset
import org.trustroots.android.ui.common.horizontalInset

data class BrowserRoute(
    val title: String,
    val url: String,
    val sessionCookie: String? = null,
)

internal val DefaultBrowserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit =
    { route, onClose, contentPadding ->
        TrustrootsBrowser(route = route, onClose = onClose, contentPadding = contentPadding)
    }

private const val EMBEDDED_SITE_TEXT_ZOOM_PERCENT = 90

internal class BrowserEntryStateViewModel : ViewModel() {
    var savedBrowserState: android.os.Bundle? = null
    var savedRouteURL: String? = null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
@SuppressLint("SetJavaScriptEnabled")
fun TrustrootsBrowser(
    route: BrowserRoute,
    onClose: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val context = LocalContext.current
    var webView by remember { mutableStateOf<WebView?>(null) }
    var externalURL by remember { mutableStateOf<BrowserLink?>(null) }
    val viewModelStoreOwner = requireNotNull(LocalViewModelStoreOwner.current)
    val browserEntryState = remember(viewModelStoreOwner) {
        ViewModelProvider(viewModelStoreOwner)[BrowserEntryStateViewModel::class.java]
    }

    BackHandler {
        val browser = webView
        if (browser?.canGoBack() == true) browser.goBack() else onClose()
    }

    externalURL?.let { link ->
        AlertDialog(
            onDismissRequest = { externalURL = null },
            title = { Text(stringResource(R.string.browser_external_website_title)) },
            text = { Text(link.host) },
            confirmButton = {
                TextButton(
                    onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link.url)))
                        externalURL = null
                    },
                ) { Text(stringResource(R.string.browser_open_external)) }
            },
            dismissButton = {
                TextButton(onClick = { externalURL = null }) { Text(stringResource(R.string.cancel)) }
            },
        )
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            PinnedTopAppBar(
                title = route.title,
                scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(),
                contentPadding = contentPadding,
                onBack = onClose,
            )
        },
    ) { paddingValues ->
        AndroidView(
            factory = { browserContext ->
                WebView(browserContext).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    // Keep the embedded site closer to its mobile-browser text size.
                    settings.textZoom = EMBEDDED_SITE_TEXT_ZOOM_PERCENT
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    settings.setGeolocationEnabled(false)
                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    settings.setSupportMultipleWindows(false)
                    settings.safeBrowsingEnabled = true
                    settings.userAgentString =
                        "${settings.userAgentString} TrustrootsAndroid/0.1 native"
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String?) {
                            applyEmbeddedBrowserStyleAfterLoad(view, url)
                            browserEntryState.savedRouteURL = route.url
                            browserEntryState.savedBrowserState = android.os.Bundle().also { view.saveState(it) }
                        }
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean {
                            val link = BrowserLink.parse(request.url.toString()) ?: return true
                            if (link.canEmbed) return false
                            externalURL = link
                            return true
                        }
                    }
                    installEmbeddedBrowserStyle(this)
                    applyBrowserSessionCookie(route.url, route.sessionCookie)
                    val restored = if (browserEntryState.savedRouteURL == route.url) {
                        browserEntryState.savedBrowserState?.let { restoreState(it) }
                    } else {
                        null
                    }
                    if (restored == null) {
                        browserEntryState.savedBrowserState = null
                        browserEntryState.savedRouteURL = route.url
                        loadUrl(route.url)
                    }
                    webView = this
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(contentPadding.horizontalInset())
                .padding(contentPadding.bottomInset()),
            onRelease = { released ->
                browserEntryState.savedRouteURL = route.url
                browserEntryState.savedBrowserState = android.os.Bundle().also { released.saveState(it) }
                released.stopLoading()
                released.destroy()
                if (webView === released) webView = null
            },
        )
    }
}

internal fun cookiePairsForWebView(cookieHeader: String): List<String> =
    cookieHeader.split(';')
        .map { it.trim() }
        .filter { it.contains('=') && !it.startsWith("Path=", true) && !it.startsWith("Domain=", true) }

internal fun applyBrowserSessionCookie(url: String, cookieHeader: String?) {
    if (cookieHeader.isNullOrBlank()) return
    val uri = runCatching { URI(url) }.getOrNull() ?: return
    val host = uri.host ?: return
    val scheme = uri.scheme ?: "https"
    val origin = "$scheme://$host"
    val manager = CookieManager.getInstance()
    manager.setAcceptCookie(true)
    cookiePairsForWebView(cookieHeader).forEach { pair ->
        manager.setCookie(origin, pair)
    }
    manager.flush()
}

internal fun installEmbeddedBrowserStyle(webView: WebView) {
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
        WebViewCompat.addDocumentStartJavaScript(
            webView, embeddedBrowserStyle, setOf("https://www.trustroots.org"),
        )
    }
}

internal fun applyEmbeddedBrowserStyleAfterLoad(
    webView: WebView,
    url: String?,
    documentStartSupported: Boolean = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT),
) {
    if (!documentStartSupported && url?.startsWith("https://www.trustroots.org/") == true) {
        webView.evaluateJavascript(embeddedBrowserStyle, null)
    }
}

internal val embeddedBrowserStyle = """
    (() => {
      if (location.hostname !== 'www.trustroots.org' || document.getElementById('trustroots-android-embedded-style')) return;
      const style = document.createElement('style');
      style.id = 'trustroots-android-embedded-style';
      style.textContent = `
        #tr-header { display: none !important; }
        .container-spacer { margin-top: 0 !important; }
        .container-fullscreen.container-spacer { top: 0 !important; }
        .home-intro .home-join,
        #manifesto a[href^="/signup"] { display: none !important; }
      `;
      (document.head || document.documentElement).appendChild(style);
    })();
""".trimIndent()
