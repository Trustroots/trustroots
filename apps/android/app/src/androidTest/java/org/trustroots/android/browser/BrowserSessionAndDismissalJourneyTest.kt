package org.trustroots.android.browser

import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import java.util.UUID
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.testing.pressBackFromNonActivityRoot

@RunWith(AndroidJUnit4::class)
class BrowserSessionAndDismissalJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val requestHeaders = CopyOnWriteArrayList<String>()
    private val responderFailure = AtomicReference<Throwable?>(null)
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null

    @After fun stopFixture() {
        runCatching { server.close() }
        runCatching { activeSocket?.close() }
        responder?.join(1_500)
        assertTrue("The loopback browser fixture should stop", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The loopback browser fixture failed", it) }
    }

    @Test fun sessionCookiesAreSentWithTheLoopbackWebViewRequest() {
        val origin = "http://127.0.0.1:${server.localPort}"
        val uniqueSuffix = UUID.randomUUID().toString().replace("-", "")
        val uniqueSessionCookieName = "fictional-session-$uniqueSuffix"
        val uniqueDisplayCookieName = "fictional-display-$uniqueSuffix"
        startSinglePageResponder()
        try {
            compose.setContent {
                DefaultBrowserContent(
                    BrowserRoute(
                        title = "Fictional local page",
                        url = "$origin/session",
                        sessionCookie = "$uniqueSessionCookieName=fictional; $uniqueDisplayCookieName=compact; Path=/; HttpOnly",
                    ),
                    {},
                    PaddingValues.Zero,
                )
            }
            compose.waitUntil("loopback WebView request with session cookie", 10_000) {
                requestHeaders.isNotEmpty()
            }
            val cookieHeader = requestHeaders.single()
            assertTrue(cookieHeader.contains("$uniqueSessionCookieName=fictional"))
            assertTrue(cookieHeader.contains("$uniqueDisplayCookieName=compact"))
            assertFalse(cookieHeader.contains("Path="))
            assertFalse(cookieHeader.contains("HttpOnly"))
            responder?.join(1_000)
            assertTrue("The fixture should finish after the page request", responder?.isAlive != true)
            responderFailure.get()?.let { throw AssertionError("The loopback browser fixture failed", it) }
        } finally {
            compose.runOnUiThread {
                val manager = CookieManager.getInstance()
                manager.setCookie(origin, "$uniqueSessionCookieName=; Max-Age=0; Path=/")
                manager.setCookie(origin, "$uniqueDisplayCookieName=; Max-Age=0; Path=/")
                manager.flush()
            }
        }
    }

    @Test fun protocolRelativeSessionCookieCanBeAppliedAndCleared() {
        val origin = "https://example.test"
        val secureURL = "$origin/path"
        val cookieManager = CookieManager.getInstance()
        val uniqueSuffix = UUID.randomUUID().toString().replace("-", "")
        val uniqueCookieName = "fictional-protocol-relative-$uniqueSuffix"
        val cookie = "$uniqueCookieName=fictional"

        compose.runOnUiThread {
            applyBrowserSessionCookie("//example.test/path", "$cookie; Path=/")
            cookieManager.flush()
        }

        try {
            compose.waitUntil("protocol-relative session cookie on HTTPS origin", 5_000) {
                cookieManager.getCookie(secureURL).orEmpty().contains(cookie)
            }
        } finally {
            compose.runOnUiThread {
                cookieManager.setCookie(origin, "$uniqueCookieName=; Max-Age=0; Path=/; Secure")
                cookieManager.flush()
            }
        }

        compose.waitUntil("protocol-relative session cookie cleanup", 5_000) {
            !cookieManager.getCookie(secureURL).orEmpty().contains(cookie)
        }
    }

    @Test fun backDismissesExternalConfirmationWithoutClosingBrowserRoute() {
        var closeCount = 0
        val openedIntents = mutableListOf<Intent>()
        compose.setContent {
            val current = LocalContext.current
            CompositionLocalProvider(
                LocalContext provides object : ContextWrapper(current) {
                    override fun startActivity(intent: Intent) { openedIntents += intent }
                },
            ) {
                TrustrootsBrowser(BrowserRoute("Fictional help", "about:blank"), { closeCount++ })
            }
        }
        compose.runOnIdle {
            val webView = requireNotNull(findWebView(compose.activity.window.decorView))
            assertTrue(
                webView.webViewClient.shouldOverrideUrlLoading(
                    webView,
                    request("https://outside.example.invalid/help"),
                ),
            )
        }
        compose.onNodeWithText("Open external website?").assertIsDisplayed()

        pressBackFromNonActivityRoot(compose.activity)
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Open external website?").fetchSemanticsNodes().isEmpty()
        }
        assertTrue(openedIntents.isEmpty())
        compose.runOnIdle { assertEquals(0, closeCount) }

        Espresso.pressBack()
        compose.runOnIdle { assertEquals(1, closeCount) }
    }

    private fun startSinglePageResponder() {
        responder = thread(isDaemon = true, name = "browser-cookie-loopback") {
            try {
                val socket = server.accept()
                activeSocket = socket
                socket.use { client ->
                    client.soTimeout = 5_000
                    val reader = client.getInputStream().bufferedReader()
                    val requestLine = reader.readLine().orEmpty()
                    while (true) {
                        val header = reader.readLine() ?: break
                        if (header.isEmpty()) break
                        if (header.startsWith("Cookie:", ignoreCase = true)) requestHeaders += header.substringAfter(':').trim()
                    }
                    if (requestLine != "GET /session HTTP/1.1") {
                        throw AssertionError("Unexpected loopback WebView request: $requestLine")
                    }
                    val body = "<html><head><title>Fictional local page</title></head><body>Local fixture</body></html>"
                    val bytes = body.toByteArray(Charsets.UTF_8)
                    client.getOutputStream().apply {
                        write(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(bytes)
                        flush()
                    }
                }
            } catch (error: SocketTimeoutException) {
                responderFailure.compareAndSet(null, error)
            } catch (error: SocketException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: IOException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: Throwable) {
                responderFailure.compareAndSet(null, error)
            } finally {
                activeSocket?.let { runCatching { it.close() } }
            }
        }
    }

    private fun request(url: String) = object : WebResourceRequest {
        override fun getUrl(): Uri = Uri.parse(url)
        override fun isForMainFrame() = true
        override fun isRedirect() = false
        override fun hasGesture() = true
        override fun getMethod() = "GET"
        override fun getRequestHeaders(): Map<String, String> = emptyMap()
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }
}
