package org.trustroots.android.browser

import android.annotation.SuppressLint
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.viewinterop.AndroidView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlin.coroutines.CoroutineContext
import org.bouncycastle.crypto.signers.BIP340Signer
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.nostr.AndroidNostrKeys
import org.trustroots.android.nostr.nostrAccountScope

@RunWith(AndroidJUnit4::class)
class AndroidNip07JourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    @SuppressLint("SetJavaScriptEnabled")
    fun signsARadioEventAndRejectsFramesUntrustedOriginsAndInactiveSessions() {
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
        assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
        val base = "https://www.trustroots.org"
        val keys = AndroidNostrKeys(compose.activity, nostrAccountScope(base, "radio-${UUID.randomUUID()}"))
        keys.import("0".repeat(63) + "1")
        lateinit var web: WebView
        lateinit var bridge: AndroidNip07Bridge
        var committedURL: String? = null
        var isCurrent = true
        val session = BrowserNostrSession(keys) { isCurrent }
        val signingDispatcher = SigningDispatcher()
        try {
            compose.setContent {
                val scope = rememberCoroutineScope()
                AndroidView(factory = { context ->
                    WebView(context).also { view ->
                        web = view
                        view.settings.javaScriptEnabled = true
                        bridge = AndroidNip07Bridge(session, CoroutineScope(scope.coroutineContext + signingDispatcher))
                        view.webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                                committedURL = null
                                bridge.pageChanged()
                            }
                            override fun onPageCommitVisible(view: WebView, url: String) {
                                committedURL = url
                                bridge.pageCommitted()
                            }
                            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                                val html = if (request.url.path == "/frame") frameFixture else "<!doctype html><title>Radio fixture</title><p>Radio fixture</p>"
                                return WebResourceResponse("text/html", "UTF-8", ByteArrayInputStream(html.encodeToByteArray()))
                            }
                        }
                        bridge.install(view)
                        view.loadUrl("$base/circles/radio")
                    }
                }, modifier = Modifier.fillMaxSize(), onRelease = { it.destroy() })
            }
            awaitPage { committedURL == "$base/circles/radio" && web.progress == 100 }
            eval(web, """
                (async () => {
                  try {
                    window.radioKey = await window.nostr.getPublicKey();
                    window.radioResult = await window.nostr.signEvent({
                      kind:1, created_at:1800000000, content:'Hello from Android Radio',
                      tags:[['t','radiostr']]
                    });
                  } catch (error) { window.radioError = error.message; }
                })();
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.radioResult || window.radioError)") == "true" }
            assertEquals("null", eval(web, "window.radioError"))
            val event = JSONObject(eval(web, "window.radioResult"))
            assertEquals(event.getString("pubkey"), JSONTokener(eval(web, "window.radioKey")).nextValue())
            assertEquals("Hello from Android Radio", event.getString("content"))
            val hash = decodeHex(event.getString("id"))
            val verifier = BIP340Signer().apply {
                init(false, BIP340Signer.decodePublicKey(decodeHex(event.getString("pubkey"))))
                update(hash, 0, hash.size)
            }
            assertTrue(verifier.verifySignature(decodeHex(event.getString("sig"))))

            val binaryMessagesSupported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
            eval(web, """
                (() => {
                  const bridge = window.trustrootsAndroidNip07;
                  const original = bridge.onmessage;
                  window.bridgeResponses = [];
                  bridge.onmessage = ({data}) => {
                    const response = JSON.parse(data);
                    window.bridgeResponses.push(response);
                    if (response.id === 'unsupported') bridge.onmessage = original;
                  };
                  if ($binaryMessagesSupported) bridge.postMessage(new Uint8Array([1, 2, 3]).buffer);
                  bridge.postMessage('invalid JSON');
                  bridge.postMessage(JSON.stringify({method:'getPublicKey'}));
                  bridge.postMessage(JSON.stringify({id:1, method:'getPublicKey'}));
                  bridge.postMessage(JSON.stringify({id:'', method:'getPublicKey'}));
                  bridge.postMessage(JSON.stringify({id:'x'.repeat(65), method:'getPublicKey'}));
                  bridge.postMessage(JSON.stringify({id:'too-large', method:'x'.repeat(65536)}));
                  bridge.postMessage(JSON.stringify({id:'unsupported', method:'encrypt'}));
                })();
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "window.bridgeResponses.length") != "0" }
            assertEquals("1", eval(web, "window.bridgeResponses.length"))
            val rejected = JSONObject(eval(web, "window.bridgeResponses[0]"))
            assertEquals("unsupported", rejected.getString("id"))
            assertEquals("Unsupported Nostr operation.", rejected.getString("error"))

            compose.runOnUiThread { bridge.pageChanged() }
            eval(web, """
                window.nostr.getPublicKey().then(
                  () => window.uncommittedPageResult = 'returned a key',
                  error => window.uncommittedPageResult = error.message
                );
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.uncommittedPageResult)") == "true" }
            assertEquals(
                "Nostr signing is available only to a trusted top-level page in an active session.",
                JSONTokener(eval(web, "window.uncommittedPageResult")).nextValue(),
            )
            compose.runOnUiThread { bridge.pageCommitted() }

            compose.runOnUiThread { signingDispatcher.holdNext = true }
            eval(web, """
                window.nostr.getPublicKey().then(
                  () => window.pendingRequest = 'returned a key',
                  error => window.pendingRequest = error.message
                );
                window.nostr.getPublicKey().then(
                  () => window.parallelRequest = 'returned a key',
                  error => window.parallelRequest = error.message
                );
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.parallelRequest)") == "true" }
            assertEquals("A Nostr request is already in progress.", JSONTokener(eval(web, "window.parallelRequest")).nextValue())
            assertEquals("null", eval(web, "window.pendingRequest"))
            compose.runOnUiThread {
                keys.remove()
                keys.import("0".repeat(63) + "2")
                signingDispatcher.release()
            }
            compose.waitUntil(10_000) { eval(web, "Boolean(window.pendingRequest)") == "true" }
            assertEquals("The signing session or local key changed.", JSONTokener(eval(web, "window.pendingRequest")).nextValue())

            compose.runOnUiThread { signingDispatcher.holdNext = true }
            eval(web, """
                window.nostr.getPublicKey().then(
                  () => window.signedOutRequest = 'returned a key',
                  error => window.signedOutRequest = error.message
                );
                window.nostr.getPublicKey().catch(error => window.requestAlreadyPending = error.message);
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.requestAlreadyPending)") == "true" }
            assertEquals("A Nostr request is already in progress.", JSONTokener(eval(web, "window.requestAlreadyPending")).nextValue())
            compose.runOnUiThread {
                isCurrent = false
                signingDispatcher.release()
            }
            compose.waitUntil(10_000) { eval(web, "Boolean(window.signedOutRequest)") == "true" }
            assertEquals("The signing session or local key changed.", JSONTokener(eval(web, "window.signedOutRequest")).nextValue())
            compose.runOnUiThread { isCurrent = true }

            eval(web, """
                window.nostr.signEvent({kind: 'invalid'}).then(
                  () => window.invalidEventResult = 'signed',
                  error => window.invalidEventResult = error.message
                );
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.invalidEventResult)") == "true" }
            assertEquals("This Nostr request could not be completed.", JSONTokener(eval(web, "window.invalidEventResult")).nextValue())

            keys.remove()
            eval(web, """
                window.nostr.getPublicKey().then(
                  () => window.removedKeyResult = 'returned a key',
                  error => window.removedKeyResult = error.message
                );
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.removedKeyResult)") == "true" }
            assertEquals("Create or import a local Nostr key in Account.", JSONTokener(eval(web, "window.removedKeyResult")).nextValue())

            eval(web, """
                window.addEventListener('message', event => { window.frameDecision = event.data; });
                const frame = document.createElement('iframe');
                frame.src = '/frame';
                document.body.append(frame);
            """.trimIndent())
            assertEquals("denied", JSONTokener(awaitValue(web, "window.frameDecision")).nextValue())

            compose.runOnUiThread { isCurrent = false }
            eval(web, "window.nostr.getPublicKey().then(() => window.staleSessionDecision='allowed', () => window.staleSessionDecision='denied')")
            compose.waitUntil(10_000) { eval(web, "Boolean(window.staleSessionDecision)") == "true" }
            assertEquals("denied", JSONTokener(eval(web, "window.staleSessionDecision")).nextValue())

            compose.runOnUiThread {
                isCurrent = true
                session.pause()
            }
            eval(web, "window.nostr.getPublicKey().then(() => window.sessionDecision='allowed', () => window.sessionDecision='denied')")
            assertEquals("denied", JSONTokener(awaitValue(web, "window.sessionDecision")).nextValue())

            compose.runOnUiThread {
                web.loadUrl("https://trustroots.org.example.test/")
            }
            awaitPage { committedURL == "https://trustroots.org.example.test/" && web.progress == 100 }
            assertEquals("true", eval(web, "typeof window.nostr === 'undefined' && typeof window.trustrootsAndroidNip07 === 'undefined'"))
        } finally {
            keys.remove()
        }
    }

    private fun awaitPage(hasCommitted: () -> Boolean) {
        compose.waitUntil(10_000) {
            var loaded = false
            compose.runOnUiThread { loaded = hasCommitted() }
            loaded
        }
    }

    private fun awaitValue(view: WebView, script: String): String {
        var value = "null"
        compose.waitUntil(15_000) {
            value = eval(view, script)
            value != "null"
        }
        return value
    }

    private fun eval(view: WebView, script: String): String {
        lateinit var result: String
        val latch = CountDownLatch(1)
        compose.runOnUiThread { view.evaluateJavascript(script) { result = it; latch.countDown() } }
        assertTrue("WebView did not return the JavaScript result", latch.await(10, TimeUnit.SECONDS))
        return result
    }

    private fun decodeHex(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    private class SigningDispatcher : CoroutineDispatcher() {
        @Volatile var holdNext = false
        private var pending: Runnable? = null

        override fun dispatch(context: CoroutineContext, block: Runnable) {
            if (holdNext) {
                holdNext = false
                pending = block
            } else {
                Dispatchers.Main.dispatch(context, block)
            }
        }

        fun release() {
            val block = checkNotNull(pending)
            pending = null
            block.run()
        }
    }

    private val frameFixture = """
        <!doctype html><script>
        const bridge = window.trustrootsAndroidNip07;
        if (window.nostr) parent.postMessage('allowed', '*');
        else if (!bridge) parent.postMessage('denied', '*');
        else {
          bridge.onmessage = event => parent.postMessage(JSON.parse(event.data).error ? 'denied' : 'allowed', '*');
          bridge.postMessage(JSON.stringify({id:'frame', method:'getPublicKey'}));
        }
        </script>
    """.trimIndent()
}
