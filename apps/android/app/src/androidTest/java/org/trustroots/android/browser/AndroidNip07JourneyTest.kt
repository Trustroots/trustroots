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
        var committedURL: String? = null
        val session = BrowserNostrSession(keys) { true }
        try {
            compose.setContent {
                val scope = rememberCoroutineScope()
                AndroidView(factory = { context ->
                    WebView(context).also { view ->
                        web = view
                        view.settings.javaScriptEnabled = true
                        val bridge = AndroidNip07Bridge(session, scope)
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

            eval(web, """
                window.addEventListener('message', event => { window.frameDecision = event.data; });
                const frame = document.createElement('iframe');
                frame.src = '/frame';
                document.body.append(frame);
            """.trimIndent())
            compose.waitUntil(10_000) { eval(web, "Boolean(window.frameDecision)") == "true" }
            assertEquals("denied", JSONTokener(eval(web, "window.frameDecision")).nextValue())

            compose.runOnUiThread { session.pause() }
            eval(web, "window.nostr.getPublicKey().then(() => window.sessionDecision='allowed', () => window.sessionDecision='denied')")
            compose.waitUntil(10_000) { eval(web, "Boolean(window.sessionDecision)") == "true" }
            assertEquals("denied", JSONTokener(eval(web, "window.sessionDecision")).nextValue())

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

    private fun eval(view: WebView, script: String): String {
        lateinit var result: String
        val latch = CountDownLatch(1)
        compose.runOnUiThread { view.evaluateJavascript(script) { result = it; latch.countDown() } }
        assertTrue(latch.await(3, TimeUnit.SECONDS))
        return result
    }

    private fun decodeHex(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

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
