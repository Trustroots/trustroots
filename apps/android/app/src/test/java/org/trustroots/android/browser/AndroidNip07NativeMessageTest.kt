package org.trustroots.android.browser

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptExecutionException
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.ScriptHandler
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewOutcomeReceiver
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import org.json.JSONObject
import org.junit.Assert.assertEquals
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
@Config(
    sdk = [28],
    manifest = Config.NONE,
    instrumentedPackages = ["androidx.webkit"],
    shadows = [AndroidNip07NativeMessageTest.SigningFeatures::class, AndroidNip07NativeMessageTest.BridgeRegistration::class],
)
class AndroidNip07NativeMessageTest {
    @Test fun ignoresNullAndBinaryNativeMessagesAndRejectsAnUnsupportedOperation() {
        withInstalledBridge(isCurrent = { true }) { origin, view, bridge, listener ->
            val replies = LinkedBlockingQueue<JSONObject>()
            val reply = recordingReply(replies)
            val request = WebMessageCompat("""{"id":"unsupported","method":"unknown"}""")

            listener.onPostMessage(view, request, origin, true, reply)
            val pending = replies.remove()
            assertEquals("unsupported", pending.getString("id"))
            assertEquals("Nostr signing is available only to a trusted top-level page in an active session.", pending.getString("error"))

            bridge.pageCommitted()
            listener.onPostMessage(view, WebMessageCompat(null as String?), origin, true, reply)
            listener.onPostMessage(view, WebMessageCompat(byteArrayOf(1)), origin, true, reply)
            assertTrue(replies.isEmpty())

            listener.onPostMessage(view, request, origin, true, reply)
            val unsupported = replies.remove()
            assertEquals("unsupported", unsupported.getString("id"))
            assertEquals("Unsupported Nostr operation.", unsupported.getString("error"))
        }
    }

    @Test fun rechecksTheSessionBeforeReturningAnInFlightRequest() {
        var sessionChecks = 0
        withInstalledBridge(isCurrent = { ++sessionChecks == 1 }) { origin, view, bridge, listener ->
            val replies = LinkedBlockingQueue<JSONObject>()
            bridge.pageCommitted()
            listener.onPostMessage(
                view, WebMessageCompat("""{"id":"pending","method":"getPublicKey"}"""), origin, true, recordingReply(replies),
            )
            val pending = requireNotNull(replies.poll(5, TimeUnit.SECONDS))
            assertEquals("pending", pending.getString("id"))
            assertEquals("The signing session or local key changed.", pending.getString("error"))
        }
    }

    private fun withInstalledBridge(
        isCurrent: () -> Boolean,
        test: (Uri, WebView, AndroidNip07Bridge, WebViewCompat.WebMessageListener) -> Unit,
    ) {
        val origin = "https://www.trustroots.org"
        val context = RuntimeEnvironment.getApplication()
        val view = WebView(context)
        val scope = CoroutineScope(Dispatchers.Unconfined)
        try {
            val keys = AndroidNostrKeys(context, nostrAccountScope(origin, "browser-fixture"))
            val bridge = AndroidNip07Bridge(BrowserNostrSession(keys, isCurrent), scope)
            view.loadUrl(origin)
            bridge.install(view)
            val listener = requireNotNull(BridgeRegistration.listener)
            assertTrue(requireNotNull(BridgeRegistration.script).contains("window.nostr"))
            test(Uri.parse(origin), view, bridge, listener)
        } finally {
            BridgeRegistration.listener = null
            BridgeRegistration.script = null
            scope.cancel()
            view.destroy()
        }
    }

    private fun recordingReply(replies: LinkedBlockingQueue<JSONObject>) = object : JavaScriptReplyProxy() {
        override fun postMessage(message: String) { replies.add(JSONObject(message)) }
        override fun postMessage(message: ByteArray) = error("Expected a JSON reply")
        override fun executeJavaScript(
            script: String,
            receiver: WebViewOutcomeReceiver<String, JavaScriptExecutionException>?,
        ) = error("The signing bridge must send replies without evaluating JavaScript")
    }

    @Implements(WebViewFeature::class, isInAndroidSdk = false)
    class SigningFeatures {
        companion object {
            @JvmStatic @Implementation
            fun isFeatureSupported(feature: String): Boolean =
                feature == WebViewFeature.WEB_MESSAGE_LISTENER || feature == WebViewFeature.DOCUMENT_START_SCRIPT
        }
    }

    @Implements(WebViewCompat::class, isInAndroidSdk = false)
    class BridgeRegistration {
        companion object {
            var listener: WebViewCompat.WebMessageListener? = null
            var script: String? = null

            @JvmStatic @Implementation
            fun addWebMessageListener(
                view: WebView, name: String, origins: Set<String>, callback: WebViewCompat.WebMessageListener,
            ) {
                assertEquals("trustrootsAndroidNip07", name)
                assertTrue(origins.contains("https://*.trustroots.org"))
                listener = callback
            }

            @JvmStatic @Implementation
            fun addDocumentStartJavaScript(view: WebView, source: String, origins: Set<String>): ScriptHandler {
                assertTrue(origins.contains("https://hitchwiki.org"))
                script = source
                return ScriptHandler {}
            }
        }
    }
}
