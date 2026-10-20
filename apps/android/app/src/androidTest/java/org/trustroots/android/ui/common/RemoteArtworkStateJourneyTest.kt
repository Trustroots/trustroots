package org.trustroots.android.ui.common

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RemoteArtworkStateJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0).apply { soTimeout = 250 }
    private val secondRequestStarted = CountDownLatch(1)
    private val allowSecondResponse = CountDownLatch(1)
    private val fixtureFailure = AtomicReference<Throwable?>()
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null

    @After fun closeServer() {
        allowSecondResponse.countDown()
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        assertTrue("Anonymous artwork fixture should stop after shutdown", responder?.isAlive != true)
        fixtureFailure.get()?.let { throw AssertionError("Anonymous artwork fixture failed", it) }
    }

    @Test fun changingArtworkUrlAndSessionShowsLoadingInsteadOfThePreviousBitmap() {
        val firstImage = png(2, 1)
        val secondImage = png(8, 4)
        responder = thread(isDaemon = true, name = "anonymous-artwork-state-fixture") {
            serve(firstImage, secondImage)
        }
        val firstUrl = java.net.URL("http://127.0.0.1:${server.localPort}/first")
        val secondUrl = java.net.URL("http://127.0.0.1:${server.localPort}/second")
        val firstCookie = "connect.sid=fictional-artwork-session-one"
        val secondCookie = "connect.sid=fictional-artwork-session-two"
        val selectedRequest = mutableStateOf(ArtworkRequest(firstUrl, firstCookie))

        compose.setContent {
            MaterialTheme {
                Column {
                    val state = rememberArtworkBitmapState(selectedRequest.value.url, selectedRequest.value.cookie)
                    val label = when (state) {
                        ArtworkBitmapState.Loading -> "Loading artwork"
                        ArtworkBitmapState.Failed -> "Artwork failed"
                        is ArtworkBitmapState.Loaded -> "Loaded ${state.bitmap.width} pixel image"
                    }
                    Text(label)
                    Text(selectedRequest.value.url.path)
                }
            }
        }

        compose.waitUntil(10_000) {
            hasNode("Loaded 2 pixel image") && fixtureFailure.get() == null
        }
        compose.runOnUiThread { selectedRequest.value = ArtworkRequest(secondUrl, secondCookie) }
        compose.waitUntil(10_000) { secondRequestStarted.count == 0L }
        assertTrue(hasNode("Loading artwork"))
        assertTrue(!hasNode("Loaded 2 pixel image"))
        allowSecondResponse.countDown()
        compose.waitUntil(10_000) { hasNode("Loaded 8 pixel image") }
        assertEquals(secondCookie, fixtureCookie.get())
    }

    private val fixtureCookie = AtomicReference<String?>()

    private data class ArtworkRequest(val url: java.net.URL, val cookie: String)

    private fun hasNode(text: String): Boolean = compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()

    private fun png(width: Int, height: Int): ByteArray = ByteArrayOutputStream().use { output ->
        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            .compress(Bitmap.CompressFormat.PNG, 100, output)
        output.toByteArray()
    }

    private fun serve(firstImage: ByteArray, secondImage: ByteArray) {
        while (!server.isClosed) {
            val socket = try {
                server.accept()
            } catch (_: SocketTimeoutException) {
                continue
            } catch (error: SocketException) {
                if (server.isClosed) return else {
                    fixtureFailure.compareAndSet(null, error)
                    return
                }
            }
            activeSocket = socket
            try {
                socket.use { connection ->
                    val input = connection.getInputStream().bufferedReader()
                    val requestLine = input.readLine().orEmpty()
                    var cookie: String? = null
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        if (header.startsWith("Cookie:", ignoreCase = true)) cookie = header.substringAfter(':').trim()
                    }
                    val path = requestLine.substringAfter(' ').substringBefore(' ')
                    val bytes = when (path) {
                        "/first" -> firstImage
                        "/second" -> {
                            fixtureCookie.set(cookie)
                            secondRequestStarted.countDown()
                            if (!allowSecondResponse.await(10, TimeUnit.SECONDS)) {
                                throw IOException("Delayed fixture response timed out")
                            }
                            secondImage
                        }
                        else -> ByteArray(0)
                    }
                    val status = if (bytes.isEmpty()) "404 Not Found" else "200 OK"
                    connection.getOutputStream().apply {
                        write(
                            "HTTP/1.1 $status\r\nContent-Type: image/png\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(bytes)
                        flush()
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) {
                    fixtureFailure.compareAndSet(null, IOException("Anonymous artwork fixture failed", error))
                    return
                }
            } finally {
                activeSocket = null
            }
        }
    }
}
