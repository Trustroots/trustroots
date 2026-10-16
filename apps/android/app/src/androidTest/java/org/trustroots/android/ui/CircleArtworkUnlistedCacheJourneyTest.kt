package org.trustroots.android.ui

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.system.Os
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
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CircleArtworkUnlistedCacheJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val requestedPath = AtomicReference<String?>()
    private var responder: Thread? = null
    private var isolatedCache: java.io.File? = null
    private var artworkDirectory: java.io.File? = null
    private var originalDirectoryMode: Int? = null

    @After fun restorePermissionsAndStopFixture() {
        try {
            originalDirectoryMode?.let { mode ->
                artworkDirectory?.let { directory ->
                    if (directory.exists()) Os.chmod(directory.path, mode)
                }
            }
        } finally {
            runCatching { server.close() }
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder?.join(2_000)
            isolatedCache?.let { root ->
                if (root.exists()) assertTrue("The isolated artwork cache should be removed", root.deleteRecursively())
            }
        }
        assertTrue("The local image fixture should stop", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The local image fixture failed", it) }
    }

    @Test fun validArtworkIsDisplayedAndSavedWhenCacheDirectoryCannotBeListed() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val cacheRoot = java.nio.file.Files.createTempDirectory(target.cacheDir.toPath(), "fictional-artwork-unlisted-").toFile()
        isolatedCache = cacheRoot
        val directory = java.io.File(cacheRoot, "circle-artwork").apply {
            assertTrue("The isolated artwork directory should be created", mkdir())
        }
        artworkDirectory = directory
        originalDirectoryMode = Os.stat(directory.path).st_mode and 0x1ff

        val image = png()
        val imageURL = java.net.URL("http://127.0.0.1:${server.localPort}/uploads-circle/unlisted-${System.nanoTime()}.png")
        val scopedContext = object : ContextWrapper(target) {
            override fun getCacheDir() = cacheRoot
            override fun getApplicationContext(): Context = this
        }

        serveImage(image)
        Os.chmod(directory.path, 0xC0) // owner write+execute only: file creation works, directory listing does not.
        assertTrue("The fixture directory must remain writable", directory.canWrite())
        assertTrue("The fixture directory must remain traversable", directory.canExecute())
        assertNull("The fixture must prove listFiles() fails before artwork is loaded", directory.listFiles())

        try {
            compose.setContent {
                CompositionLocalProvider(LocalContext provides scopedContext) {
                    MaterialTheme {
                        RemoteArtwork(imageURL, null, "Unlisted Circle", 64.dp)
                    }
                }
            }

            compose.waitUntil("the valid local artwork is decoded", 10_000) {
                compose.onAllNodesWithContentDescription("Unlisted Circle image").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithContentDescription("Unlisted Circle image").assertIsDisplayed()

            responder?.join(2_000)
            assertTrue("The image request should complete before inspecting the saved snapshot", responder?.isAlive != true)
            assertEquals(imageURL.path, requestedPath.get())
            responderFailure.get()?.let { throw AssertionError("The local image fixture failed", it) }

            // Loading has returned only after the cache write and failed pruning attempt.
            Os.chmod(directory.path, requireNotNull(originalDirectoryMode))
            val snapshots = requireNotNull(directory.listFiles())
            assertEquals("Exactly one snapshot should be saved", 1, snapshots.size)
            assertArrayEquals("The saved snapshot should contain the received PNG bytes", image, snapshots.single().readBytes())
        } finally {
            originalDirectoryMode?.let { Os.chmod(directory.path, it) }
        }
    }

    private fun serveImage(image: ByteArray) {
        responder = thread(isDaemon = true, name = "circle-artwork-unlisted-cache") {
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
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
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
    }

    private fun png(): ByteArray = ByteArrayOutputStream().use { output ->
        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.CYAN)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }
}
