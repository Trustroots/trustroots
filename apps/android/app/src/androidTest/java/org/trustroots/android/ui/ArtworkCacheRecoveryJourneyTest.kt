package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ArtworkCacheRecoveryJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null
    private var cachedFile: File? = null
    private val requested = AtomicBoolean(false)

    @After fun cleanUp() {
        server.close()
        activeSocket?.close()
        responder?.join(2_000)
        cachedFile?.delete()
    }

    @Test fun staleCircleArtworkRemainsVisibleWhenRefreshFails() {
        val url = java.net.URL("http://127.0.0.1:${server.localPort}/uploads-circle/stale-fixture.png")
        val image = png()
        prepareCache(url, image).setLastModified(System.currentTimeMillis() - 8L * 24 * 60 * 60 * 1_000)
        respond(503, ByteArray(0))
        compose.setContent {
            MaterialTheme {
                ArtworkHero(url, null, "Quiet Meadow", "A fictional circle", Color.Blue, true, "cachedHero")
            }
        }
        awaitImage("Quiet Meadow image")
        assertTrue("Stale artwork should trigger a refresh", requested.get())
        assertArrayEquals(image, requireNotNull(cachedFile).readBytes())
    }

    @Test fun corruptCircleCacheIsReplacedWithDownloadedArtwork() {
        val url = java.net.URL("http://127.0.0.1:${server.localPort}/uploads-circle/corrupt-fixture.png")
        prepareCache(url, "invalid image".toByteArray())
        val replacement = png()
        respond(200, replacement)
        compose.setContent {
            MaterialTheme { RemoteArtwork(url, null, "River Circle", 64.dp) }
        }
        awaitImage("River Circle image")
        assertTrue("An unreadable cache must be refreshed", requested.get())
        assertArrayEquals(replacement, requireNotNull(cachedFile).readBytes())
    }

    private fun awaitImage(description: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription(description).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription(description).assertIsDisplayed()
    }

    private fun prepareCache(url: java.net.URL, bytes: ByteArray): File {
        val digest = MessageDigest.getInstance("SHA-256").digest(url.toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        return File(context.cacheDir, "circle-artwork/$digest").also {
            it.parentFile?.mkdirs()
            it.writeBytes(bytes)
            cachedFile = it
        }
    }

    private fun png(): ByteArray = ByteArrayOutputStream().use { output ->
        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.GREEN)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }

    private fun respond(status: Int, body: ByteArray) {
        responder = thread(isDaemon = true, name = "artwork-cache-fixture") {
            try {
                server.accept().use { socket ->
                    activeSocket = socket
                    socket.soTimeout = 5_000
                    val input = socket.getInputStream().bufferedReader()
                    input.readLine()
                    while (!input.readLine().isNullOrEmpty()) { /* Consume request headers. */ }
                    requested.set(true)
                    val output = socket.getOutputStream()
                    output.write("HTTP/1.1 $status Fixture\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    output.write(body)
                    output.flush()
                }
            } catch (error: java.io.IOException) {
                if (!server.isClosed) throw error
            } finally {
                activeSocket = null
            }
        }
    }
}
