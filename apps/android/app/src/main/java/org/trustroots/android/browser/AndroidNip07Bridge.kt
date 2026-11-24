package org.trustroots.android.browser

import android.webkit.WebView
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.net.URI
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import org.trustroots.android.nostr.AndroidNostrKeys
import org.trustroots.android.nostr.NostrEventSigner

/** Provided only by the signed-in native shell. The predicate reads live session state. */
internal class BrowserNostrSession(val keys: AndroidNostrKeys, private val isSessionCurrent: () -> Boolean) {
    private var paused = false

    fun isActive(): Boolean = !paused && isSessionCurrent()

    fun pause() { paused = true }
}

internal val LocalBrowserNostrSession = staticCompositionLocalOf<BrowserNostrSession?> { null }

private val signingOrigins = setOf(
    "https://trustroots.org", "https://www.trustroots.org",
    "https://hitchwiki.org", "https://www.hitchwiki.org",
)

internal fun trustedSigningOrigin(url: String?): String? {
    val uri = url?.let { runCatching { URI(it) }.getOrNull() } ?: return null
    val link = BrowserLink.parse(url) ?: return null
    if (!link.canEmbed || uri.rawUserInfo != null || uri.port !in setOf(-1, 443)) return null
    return "https://${link.host.lowercase()}".takeIf(signingOrigins::contains)
}

internal fun maySignFromFrame(isMainFrame: Boolean, sourceOrigin: String, currentURL: String?): Boolean {
    val origin = trustedSigningOrigin(sourceOrigin) ?: return false
    return isMainFrame && origin == trustedSigningOrigin(currentURL)
}

internal class AndroidNip07Bridge(private val session: BrowserNostrSession, private val scope: CoroutineScope) {
    private var request: Job? = null
    private var pageCommitted = false
    var approval by mutableStateOf<SigningApproval?>(null)
        private set

    class SigningApproval(val origin: String, val details: String) {
        val decision = CompletableDeferred<Boolean>()
    }

    fun declineApproval() {
        approval?.decision?.complete(false)
    }

    fun pageChanged() {
        pageCommitted = false
        request?.cancel()
        request = null
        approval = null
    }

    fun pageCommitted() { pageCommitted = true }

    fun install(view: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) return

        WebViewCompat.addWebMessageListener(view, bridgeName, signingOrigins) { webView, message, origin, mainFrame, reply ->
            val source = origin.toString()
            if (message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
            val data = message.data ?: return@addWebMessageListener
            if (data.length > maxRequestSize) return@addWebMessageListener
            val body = runCatching { JSONObject(data) }.getOrNull() ?: return@addWebMessageListener
            val id = (body.opt("id") as? String)?.takeIf { it.length in 1..64 } ?: return@addWebMessageListener

            fun respond(result: Any?, error: String? = null) {
                reply.postMessage(JSONObject().put("id", id).put("result", result).put("error", error).toString())
            }

            fun isActive() = pageCommitted && session.isActive() && maySignFromFrame(mainFrame, source, webView.url)
            if (!isActive()) {
                respond(null, "Nostr signing is available only to a trusted top-level page in an active session.")
                return@addWebMessageListener
            }
            val method = body.optString("method")
            if (method != "getPublicKey" && method != "signEvent") {
                respond(null, "Unsupported Nostr operation.")
                return@addWebMessageListener
            }
            if (request?.isActive == true) {
                respond(null, "A Nostr request is already in progress.")
                return@addWebMessageListener
            }

            val keyRevision = session.keys.revision()
            request = scope.launch {
                val event = if (method == "signEvent") {
                    val unsigned = body.optJSONObject("event")
                    val details = unsigned?.let { runCatching { NostrEventSigner.describe(it) }.getOrNull() }
                    if (details == null) {
                        respond(null, "This Nostr request could not be completed.")
                        return@launch
                    }
                    val pending = SigningApproval(source, details)
                    approval = pending
                    val accepted = try {
                        withTimeoutOrNull(60_000) { pending.decision.await() }
                    } finally {
                        if (approval === pending) approval = null
                    }
                    if (accepted != true) {
                        respond(null, "Nostr signing was not approved.")
                        return@launch
                    }
                    if (!isActive() || session.keys.revision() != keyRevision) {
                        respond(null, "The signing session or local key changed.")
                        return@launch
                    }
                    unsigned
                } else null
                val result = withContext(Dispatchers.IO) {
                    runCatching {
                        if (event == null) session.keys.browserPublicKey(keyRevision)
                        else session.keys.signBrowserEvent(event, keyRevision)
                    }
                }
                if (!isActive() || session.keys.revision() != keyRevision) {
                    respond(null, "The signing session or local key changed.")
                } else {
                    val value = result.getOrNull()
                    when {
                        result.isFailure -> respond(null, "This Nostr request could not be completed.")
                        value == null -> respond(null, "Create or import a local Nostr key in Account.")
                        else -> respond(value)
                    }
                }
            }
        }
        WebViewCompat.addDocumentStartJavaScript(view, script, signingOrigins)
    }

    private companion object {
        const val bridgeName = "trustrootsAndroidNip07"
        const val maxRequestSize = 65_536
        @JvmField
        val script = """
            (() => {
              if (window.top !== window || window.nostr || !window.$bridgeName) return;
              const bridge = window.$bridgeName;
              let sequence = 0;
              const pending = new Map();
              bridge.onmessage = ({data}) => {
                const response = JSON.parse(data);
                const callback = pending.get(response.id);
                if (!callback) return;
                pending.delete(response.id);
                clearTimeout(callback.timeout);
                if (response.error) callback.reject(new Error(response.error));
                else callback.resolve(response.result);
              };
              const request = (method, event) => new Promise((resolve, reject) => {
                const id = String(++sequence);
                const message = JSON.stringify({id, method, event});
                if (message.length > $maxRequestSize) {
                  reject(new Error('The Nostr request is too large.'));
                  return;
                }
                const timeout = setTimeout(() => {
                  pending.delete(id);
                  reject(new Error('The Nostr request timed out.'));
                }, method === 'signEvent' ? 65000 : 10000);
                pending.set(id, {resolve, reject, timeout});
                bridge.postMessage(message);
              });
              window.nostr = {
                getPublicKey: () => request('getPublicKey'),
                signEvent: event => request('signEvent', event),
              };
            })();
        """.trimIndent()
    }
}
