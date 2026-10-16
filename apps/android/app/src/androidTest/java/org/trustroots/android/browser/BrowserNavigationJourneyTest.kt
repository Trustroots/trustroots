package org.trustroots.android.browser

import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import java.io.IOException
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrowserNavigationJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun externalNavigationRequiresConfirmationAndCanBeCancelled() {
        val opened = mutableListOf<Intent>()
        var closed = 0
        compose.setContent {
            val context = LocalContext.current
            CompositionLocalProvider(LocalContext provides object : ContextWrapper(context) {
                override fun startActivity(intent: Intent) { opened.add(intent) }
            }) {
                TrustrootsBrowser(BrowserRoute("Local help", "about:blank"), { closed++ })
            }
        }
        compose.onNodeWithText("Local help").assertExists()
        compose.runOnIdle {
            val web = requireNotNull(findWebView(compose.activity.window.decorView))
            assertTrue(web.settings.javaScriptEnabled)
            assertTrue(web.settings.domStorageEnabled)
            assertEquals(90, web.settings.textZoom)
            assertFalse(web.settings.allowFileAccess)
            assertFalse(web.settings.allowContentAccess)
            assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, web.settings.mixedContentMode)
            assertTrue(web.settings.userAgentString.endsWith(" TrustrootsAndroid/0.1 native"))
            assertFalse(web.webViewClient.shouldOverrideUrlLoading(web, request("https://www.trustroots.org/faq")))
            assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request("javascript:alert(1)")))
        }
        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        navigate("https://example.test/help")
        compose.onNodeWithText("example.test").assertExists()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        assertTrue(opened.isEmpty())

        navigate("https://example.test/guide")
        compose.onNodeWithText("Open").performClick()
        compose.runOnIdle {
            assertEquals(1, opened.size)
            assertEquals(Intent.ACTION_VIEW, opened.single().action)
            assertEquals("https://example.test/guide", opened.single().data.toString())
        }
        compose.onNodeWithText("Open external website?").assertDoesNotExist()
        compose.onNodeWithContentDescription("Back").performClick()
        assertEquals(1, closed)
    }

    @Test fun sessionCookieInjectionIgnoresAttributesAndInvalidDestinations() {
        val origin = "https://browser-fixture.example.test"
        compose.runOnIdle {
            val manager = CookieManager.getInstance()
            try {
                applyBrowserSessionCookie(origin, "journey_session=fictional; Path=/; Domain=example.test; Secure; HttpOnly")
                val cookies = manager.getCookie(origin).orEmpty()
                assertTrue(cookies.contains("journey_session=fictional"))
                assertFalse(cookies.contains("Path="))
                assertFalse(cookies.contains("Domain="))
                for (header in listOf(null, "", " ")) applyBrowserSessionCookie(origin, header)
                applyBrowserSessionCookie("not a valid URI", "journey_session=changed")
                applyBrowserSessionCookie("/relative", "journey_session=changed")
                assertTrue(manager.getCookie(origin).orEmpty().contains("journey_session=fictional"))
            } finally {
                manager.setCookie(origin, "journey_session=; Max-Age=0; Path=/")
                manager.flush()
            }
        }
    }

    @Test fun systemBackTraversesBrowserHistoryBeforeClosingTheRoute() {
        val server = ServerSocket(0).apply { soTimeout = 20_000 }
        val requests = CopyOnWriteArrayList<String>()
        val activeSocket = AtomicReference<java.net.Socket?>()
        val responderFailure = AtomicReference<Throwable?>()
        val responder = thread(isDaemon = true) {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (error: SocketException) {
                        if (server.isClosed) break
                        responderFailure.compareAndSet(null, error)
                        break
                    } catch (error: IOException) {
                        responderFailure.compareAndSet(null, error)
                        break
                    }
                    activeSocket.set(socket)
                    try {
                        socket.soTimeout = 10_000
                        socket.use {
                            val input = socket.getInputStream().bufferedReader()
                            val request = input.readLine().orEmpty()
                            requests += request
                            while (!input.readLine().isNullOrEmpty()) Unit
                            val path = request.split(' ').getOrNull(1)
                            val (status, body) = when (path) {
                                "/first" -> "200 OK" to "<html><head><title>First local page</title></head><body>First</body></html>"
                                "/second" -> "200 OK" to "<html><head><title>Second local page</title></head><body>Second</body></html>"
                                else -> "404 Not Found" to "<html><head><title>Missing local page</title></head><body>Not found</body></html>"
                            }
                            val bytes = body.toByteArray()
                            socket.getOutputStream().write(
                                "HTTP/1.1 $status\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".toByteArray(),
                            )
                            socket.getOutputStream().write(bytes)
                            socket.getOutputStream().flush()
                        }
                    } catch (_: SocketException) {
                        // WebView may cancel a request while navigating back or replacing a page.
                    } catch (error: IOException) {
                        responderFailure.compareAndSet(null, error)
                    } catch (error: Throwable) {
                        responderFailure.compareAndSet(null, error)
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                        runCatching { socket.close() }
                    }
                }
            } catch (error: Throwable) {
                responderFailure.compareAndSet(null, error)
            }
        }
        val firstURL = "http://127.0.0.1:${server.localPort}/first"
        val secondURL = "http://127.0.0.1:${server.localPort}/second"
        var closed = 0
        val pageState = AtomicReference("WebView has not reported a page load")
        try {
            compose.setContent {
                TrustrootsBrowser(BrowserRoute("Local help", firstURL), { closed++ })
            }
            try {
                compose.waitUntil("first loopback WebView page to finish loading", 10_000) {
                    var ready = false
                    compose.runOnUiThread {
                        val web = findWebView(compose.activity.window.decorView)
                        if (web != null) {
                            pageState.set("url=${web.url}, progress=${web.progress}, title=${web.title}")
                            ready = web.url == firstURL && web.progress == 100 && web.title == "First local page"
                        }
                    }
                    ready
                }
            } catch (failure: Throwable) {
                throw AssertionError("First loopback browser page did not finish loading: ${pageState.get()}; requests=$requests", failure)
            }

            compose.runOnIdle {
                requireNotNull(findWebView(compose.activity.window.decorView)).apply {
                    clearHistory()
                    loadUrl(secondURL)
                }
            }
            try {
                compose.waitUntil("second loopback WebView page to finish loading", 10_000) {
                    var ready = false
                    compose.runOnUiThread {
                        val web = findWebView(compose.activity.window.decorView)
                        if (web != null) {
                            pageState.set("url=${web.url}, progress=${web.progress}, title=${web.title}")
                            ready = web.url == secondURL && web.progress == 100 &&
                                web.title == "Second local page" && web.canGoBack()
                        }
                    }
                    ready
                }
            } catch (failure: Throwable) {
                throw AssertionError("Second loopback browser page did not finish loading: ${pageState.get()}; requests=$requests", failure)
            }

            compose.runOnIdle { compose.activity.onBackPressedDispatcher.onBackPressed() }
            try {
                compose.waitUntil("browser back to return to the first loopback page", 10_000) {
                    var returned = false
                    compose.runOnUiThread {
                        val web = findWebView(compose.activity.window.decorView)
                        if (web != null) {
                            pageState.set("url=${web.url}, progress=${web.progress}, title=${web.title}")
                            returned = web.url == firstURL && web.progress == 100 &&
                                web.title == "First local page" && !web.canGoBack()
                        }
                    }
                    returned
                }
            } catch (failure: Throwable) {
                throw AssertionError("Browser back did not restore the first page: ${pageState.get()}; requests=$requests", failure)
            }

            compose.runOnIdle {
                assertEquals(0, closed)
                compose.activity.onBackPressedDispatcher.onBackPressed()
                assertEquals(1, closed)
            }
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder.join(1_000)
            assertTrue("The loopback responder should finish after serving both pages", !responder.isAlive)
            responderFailure.get()?.let { throw AssertionError("The loopback responder failed", it) }
        } finally {
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder.join(1_000)
        }
    }

    private fun navigate(url: String) = compose.runOnIdle {
        val web = requireNotNull(findWebView(compose.activity.window.decorView))
        assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request(url)))
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
