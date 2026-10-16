package org.trustroots.android.browser

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrowserRedirectJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun externalHttpsRedirectIsPresentedForConfirmationWithoutFollowingIt() {
        val server = ServerSocket(0).apply { soTimeout = 20_000 }
        val requests = CopyOnWriteArrayList<String>()
        val activeSocket = AtomicReference<java.net.Socket?>()
        val responderFailure = AtomicReference<Throwable?>()
        val responder = thread(isDaemon = true, name = "browser-redirect-loopback") {
            try {
                val socket = server.accept()
                activeSocket.set(socket)
                socket.use {
                    socket.soTimeout = 10_000
                    val input = socket.getInputStream().bufferedReader()
                    requests += input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val body = "Redirect fixture"
                    val bytes = body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 302 Found\r\nLocation: https://outside.example.invalid/help\r\nContent-Type: text/plain\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            } catch (error: SocketException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: IOException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } catch (error: Throwable) {
                responderFailure.compareAndSet(null, error)
            } finally {
                activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            }
        }

        val localURL = "http://127.0.0.1:${server.localPort}/redirect"
        try {
            compose.setContent {
                DefaultBrowserContent(BrowserRoute("Local redirect fixture", localURL), {}, PaddingValues.Zero)
            }
            compose.waitUntil("external redirect confirmation", 10_000) {
                compose.onAllNodesWithText("Open external website?").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("outside.example.invalid").assertExists()
            compose.onNodeWithText("Cancel").performClick()
            compose.onNodeWithText("Open external website?").assertDoesNotExist()
            compose.runOnIdle {
                val webView = requireNotNull(findWebView(compose.activity.window.decorView))
                assertEquals(localURL, webView.url)
            }
            assertEquals(listOf("GET /redirect HTTP/1.1"), requests.toList())
            responderFailure.get()?.let { throw AssertionError("The loopback redirect responder failed", it) }
        } finally {
            server.close()
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder.join(1_000)
        }
        assertTrue("The loopback redirect responder should stop", !responder.isAlive)
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
