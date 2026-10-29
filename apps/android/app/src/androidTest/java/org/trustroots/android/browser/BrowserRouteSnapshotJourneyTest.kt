package org.trustroots.android.browser

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class BrowserRouteSnapshotJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 300 }
    private val requests = CopyOnWriteArrayList<String>()
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null

    @After fun stopServer() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(1_500)
        assertTrue("The local browser responder should stop after server shutdown", responder?.isAlive != true)
    }

    @Test fun replacingBrowserRouteWithSameOwnerLoadsFreshURLInsteadOfRestoringOldHistory() {
        startResponder()
        val firstURL = "http://127.0.0.1:${server.localPort}/first"
        val historyURL = "http://127.0.0.1:${server.localPort}/history"
        val replacementURL = "http://127.0.0.1:${server.localPort}/replacement"
        var browserVisible by mutableStateOf(true)
        var routeURL by mutableStateOf(firstURL)

        compose.setContent {
            TrustrootsTheme {
                if (browserVisible) {
                    TrustrootsBrowser(
                        BrowserRoute("Local browser page", routeURL),
                        onClose = { browserVisible = false },
                    )
                } else {
                    Text("Browser temporarily hidden")
                }
            }
        }

        awaitPage(firstURL, "First local route", canGoBack = false)
        compose.runOnUiThread {
            requireNotNull(findWebView(compose.activity.window.decorView)).loadUrl(historyURL)
        }
        awaitPage(historyURL, "Saved local history", canGoBack = true)

        compose.runOnIdle { browserVisible = false }
        compose.waitUntil(5_000) {
            var released = false
            compose.runOnIdle { released = findWebView(compose.activity.window.decorView) == null }
            released
        }
        compose.onNodeWithText("Browser temporarily hidden").assertExists()

        compose.runOnIdle {
            routeURL = replacementURL
            browserVisible = true
        }
        awaitPage(replacementURL, "Replacement local route", canGoBack = false)

        assertTrue("The replacement route should be fetched", requests.contains("/replacement"))
        assertEquals("The mismatched snapshot must not restore the prior route history", 1, requests.count { it == "/replacement" })
    }

    private fun awaitPage(url: String, title: String, canGoBack: Boolean) {
        compose.waitUntil("WebView page $url to load", 10_000) {
            var ready = false
            compose.runOnIdle {
                findWebView(compose.activity.window.decorView)?.let { web ->
                    ready = web.url == url && web.progress == 100 && web.title == title && web.canGoBack() == canGoBack
                }
            }
            ready
        }
    }

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "browser-route-snapshot-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket.set(socket)
                try {
                    socket.use { connection ->
                        connection.soTimeout = 3_000
                        val input = connection.getInputStream().bufferedReader()
                        val requestPath = input.readLine().orEmpty().substringAfter(' ').substringBefore(' ')
                        while (!input.readLine().isNullOrEmpty()) Unit
                        requests += requestPath
                        val (title, content) = when (requestPath) {
                            "/first" -> "First local route" to "First route body"
                            "/history" -> "Saved local history" to "History route body"
                            "/replacement" -> "Replacement local route" to "Replacement route body"
                            else -> "Missing local page" to "Missing route body"
                        }
                        val body = "<html><head><title>$title</title></head><body>$content</body></html>"
                        val bytes = body.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".toByteArray(Charsets.US_ASCII))
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket.compareAndSet(socket, null)
                }
            }
        }
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
