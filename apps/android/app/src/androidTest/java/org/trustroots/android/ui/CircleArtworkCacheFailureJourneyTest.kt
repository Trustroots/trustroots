package org.trustroots.android.ui

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CircleArtworkCacheFailureJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val failure = AtomicReference<Throwable?>()
    private val requestedPath = AtomicReference<String?>()
    private var responder: Thread? = null
    private var isolatedCache: java.io.File? = null

    @After fun closeFixture() {
        runCatching { server.close() }
        activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
        responder?.join(2_000)
        isolatedCache?.deleteRecursively()
        assertTrue("The local image fixture should stop", responder?.isAlive != true)
        failure.get()?.let { throw AssertionError("The local image fixture failed", it) }
    }

    @Test fun validCircleArtworkRemainsVisibleWhenDiskCacheCannotBeWritten() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cacheRoot = java.nio.file.Files.createTempDirectory(context.cacheDir.toPath(), "fictional-artwork-cache-").toFile()
        isolatedCache = cacheRoot
        val cacheBlocker = java.io.File(cacheRoot, "circle-artwork").apply {
            writeText("This file blocks the artwork cache directory.")
        }
        val image = png()
        val imageURL = java.net.URL("http://127.0.0.1:${server.localPort}/uploads-circle/cache-failure-${System.nanoTime()}.png")
        val expectedPath = imageURL.path
        val digest = MessageDigest.getInstance("SHA-256").digest(imageURL.toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
        val expectedCacheFile = java.io.File(cacheRoot, "circle-artwork/$digest")
        val scopedContext = object : ContextWrapper(context) {
            override fun getCacheDir() = cacheRoot
            override fun getApplicationContext(): Context = this
        }
        serveImage(image)

        compose.setContent {
            CompositionLocalProvider(LocalContext provides scopedContext) {
                MaterialTheme {
                    RemoteArtwork(imageURL, null, "Fictional Circle", 64.dp)
                }
            }
        }

        compose.waitUntil("the valid local artwork is decoded", 10_000) {
            compose.onAllNodesWithContentDescription("Fictional Circle image").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Fictional Circle image").assertIsDisplayed()
        responder?.join(2_000)

        assertEquals(expectedPath, requestedPath.get())
        assertTrue("The unwritable cache path should remain a regular file", cacheBlocker.isFile)
        assertFalse("The failed cache write must not leave an artwork snapshot", expectedCacheFile.exists())
    }

    private fun serveImage(image: ByteArray) {
        responder = thread(isDaemon = true, name = "circle-artwork-cache-failure") {
            try {
                val socket = server.accept()
                activeSocket.set(socket)
                socket.use { connection ->
                    connection.soTimeout = 5_000
                    val input = connection.getInputStream().bufferedReader()
                    val requestLine = input.readLine() ?: throw EOFException("Missing image request line")
                    while (true) {
                        val header = input.readLine() ?: throw EOFException("Incomplete image request headers")
                        if (header.isEmpty()) break
                    }
                    requestedPath.set(requestLine.substringAfter(' ').substringBefore(' '))
                    connection.getOutputStream().apply {
                        write(
                            "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${image.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(image)
                        flush()
                    }
                }
            } catch (error: SocketTimeoutException) {
                if (!server.isClosed) failure.compareAndSet(null, error)
            } catch (error: SocketException) {
                if (!server.isClosed) failure.compareAndSet(null, error)
            } catch (error: IOException) {
                if (!server.isClosed) failure.compareAndSet(null, error)
            } catch (error: Throwable) {
                failure.compareAndSet(null, error)
            } finally {
                activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            }
        }
    }

    private fun png(): ByteArray = ByteArrayOutputStream().use { output ->
        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.CYAN)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }
}
