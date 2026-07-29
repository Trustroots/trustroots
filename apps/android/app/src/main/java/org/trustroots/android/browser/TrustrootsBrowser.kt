package org.trustroots.android.browser

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
)

@Composable
@SuppressLint("SetJavaScriptEnabled")
fun TrustrootsBrowser(
    route: BrowserRoute,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    var webView by remember { mutableStateOf<WebView?>(null) }
    var externalURL by remember { mutableStateOf<String?>(null) }

    BackHandler {
        if (webView?.canGoBack() == true) webView?.goBack() else onClose()
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

    Column(Modifier.fillMaxSize()) {
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
                    loadUrl(route.url)
                    webView = this
                }
            },
            modifier = Modifier.fillMaxSize(),
        )
    }
}

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
