package org.trustroots.android.browser

import android.content.Context
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrowserHistoryRecreationJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    @Test fun systemBackTraversesBrowserHistoryAfterRealActivityRecreation() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val server = ServerSocket(0).apply { soTimeout = 500 }
        val activeSocket = AtomicReference<Socket?>()
        val serverFailure = AtomicReference<Throwable?>()
        val responder = thread(isDaemon = true, name = "browser-history-loopback") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (!server.isClosed) serverFailure.compareAndSet(null, error)
                    break
                } catch (error: IOException) {
                    if (!server.isClosed) serverFailure.compareAndSet(null, error)
                    break
                }
                activeSocket.set(socket)
                try {
                    socket.soTimeout = 5_000
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        while (!input.readLine().isNullOrEmpty()) Unit
                        val path = request.split(' ').getOrNull(1)
                        val (status, body) = when (path) {
                            "/first" -> "200 OK" to "<html><head><title>First local page</title></head><body>First</body></html>"
                            "/second" -> "200 OK" to "<html><head><title>Second local page</title></head><body>Second</body></html>"
                            else -> "404 Not Found" to "<html><head><title>Missing local page</title></head><body>Missing</body></html>"
                        }
                        val bytes = body.toByteArray()
                        connection.getOutputStream().write(
                            "HTTP/1.1 $status\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        connection.getOutputStream().write(bytes)
                        connection.getOutputStream().flush()
                    }
                } catch (_: SocketException) {
                    // WebView may cancel a navigation while restoring its history.
                } catch (error: Throwable) {
                    serverFailure.compareAndSet(null, error)
                } finally {
                    activeSocket.compareAndSet(socket, null)
                    runCatching { socket.close() }
                }
            }
        }
        val firstURL = "http://127.0.0.1:${server.localPort}/first"
        val secondURL = "http://127.0.0.1:${server.localPort}/second"
        val state = AtomicReference("WebView has not reported a page load")
        var scenario: ActivityScenario<BrowserHistoryJourneyActivity>? = null
        try {
            val runningScenario = ActivityScenario.launch<BrowserHistoryJourneyActivity>(
                Intent(context, BrowserHistoryJourneyActivity::class.java)
                    .putExtra(BrowserHistoryJourneyActivity.URL_EXTRA, firstURL),
            )
            scenario = runningScenario
            awaitPage(runningScenario, firstURL, "First local page", canGoBack = false, state = state)

            runningScenario.onActivity { activity ->
                requireNotNull(findWebView(activity.window.decorView)).apply {
                    clearHistory()
                    loadUrl(secondURL)
                }
            }
            awaitPage(runningScenario, secondURL, "Second local page", canGoBack = true, state = state)

            runningScenario.recreate()
            awaitPage(runningScenario, secondURL, "Second local page", canGoBack = true, state = state)

            runningScenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            awaitPage(runningScenario, firstURL, "First local page", canGoBack = false, state = state)

            runningScenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            compose.onNodeWithText("Browser route closed").assertExists()
            serverFailure.get()?.let { throw AssertionError("Loopback server failed", it) }
        } catch (failure: Throwable) {
            throw AssertionError("Browser history recreation failed: ${state.get()}", failure)
        } finally {
            scenario?.close()
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder.join(1_000)
        }
    }

    private fun awaitPage(
        scenario: ActivityScenario<BrowserHistoryJourneyActivity>,
        url: String,
        title: String,
        canGoBack: Boolean,
        state: AtomicReference<String>,
    ) {
        compose.waitUntil("WebView page $url to load", 10_000) {
            var ready = false
            scenario.onActivity { activity ->
                findWebView(activity.window.decorView)?.let { web ->
                    state.set("url=${web.url}, progress=${web.progress}, title=${web.title}, canGoBack=${web.canGoBack()}")
                    ready = web.url == url && web.progress == 100 && web.title == title && web.canGoBack() == canGoBack
                }
            }
            ready
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
