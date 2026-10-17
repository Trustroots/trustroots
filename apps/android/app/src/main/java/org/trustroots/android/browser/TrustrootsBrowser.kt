package org.trustroots.android.browser

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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import java.net.URI

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

@Composable
@SuppressLint("SetJavaScriptEnabled")
fun TrustrootsBrowser(
    route: BrowserRoute,
    onClose: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val context = LocalContext.current
    var webView by remember { mutableStateOf<WebView?>(null) }
    var externalURL by remember { mutableStateOf<String?>(null) }

    BackHandler {
        val currentWebView = webView
        if (currentWebView?.canGoBack() == true) currentWebView.goBack() else onClose()
    }

    externalURL?.let { url ->
        AlertDialog(
            onDismissRequest = { externalURL = null },
            title = { Text("Open external website?") },
            text = { Text(runCatching { URI(url).host }.getOrNull() ?: url) },
            confirmButton = {
                TextButton(
                    onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        externalURL = null
                    },
                ) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { externalURL = null }) { Text("Cancel") }
            },
        )
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onClose) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text(route.title, style = MaterialTheme.typography.titleMedium)
        }
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
                        }
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean {
                            val requestedURL = request.url.toString()
                            return if (isAllowedTrustrootsURL(requestedURL)) {
                                false
                            } else if (isSafeExternalURL(requestedURL)) {
                                externalURL = requestedURL
                                true
                            } else {
                                true
                            }
                        }
                    }
                    installEmbeddedBrowserStyle(this)
                    applyBrowserSessionCookie(route.url, route.sessionCookie)
                    loadUrl(route.url)
                    webView = this
                }
            },
            modifier = Modifier.fillMaxSize(),
        )
    }
}

internal fun cookiePairsForWebView(cookieHeader: String): List<String> =
    cookieHeader.split(';')
        .map { it.trim() }
        .filter { it.contains('=') && !it.startsWith("Path=", true) && !it.startsWith("Domain=", true) }

internal fun browserCookieOrigin(url: String): String? {
    val uri = runCatching { URI(url) }.getOrNull() ?: return null
    val host = uri.host ?: return null
    val scheme = uri.scheme ?: "https"
    return "$scheme://$host"
}

internal fun applyBrowserSessionCookie(url: String, cookieHeader: String?) {
    if (cookieHeader.isNullOrBlank()) return
    val origin = browserCookieOrigin(url) ?: return
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

internal fun isAllowedTrustrootsURL(url: String): Boolean = runCatching {
    val uri = URI(url)
    val host = uri.host?.lowercase() ?: return@runCatching false
    uri.scheme.equals("https", ignoreCase = true) &&
        (
            host == "trustroots.org" ||
                host.endsWith(".trustroots.org") ||
                host == "hitchwiki.org" ||
                host.endsWith(".hitchwiki.org")
        )
}.getOrDefault(false)

internal fun isSafeExternalURL(url: String): Boolean = runCatching {
    val uri = URI(url)
    uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank()
}.getOrDefault(false)
