package org.trustroots.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import java.io.File
import android.graphics.Bitmap
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLConnection
import java.net.URLStreamHandler
import java.io.InputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.common.RemoteArtwork

@RunWith(AndroidJUnit4::class)
class ArtworkAndHostResultRemainingBranchesJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val requestedPaths = CopyOnWriteArrayList<String>()
    private val receivedCookie = AtomicReference<String?>()
    private var responder: Thread? = null
    private val responderFailure = AtomicReference<Throwable?>()
    private var cachedFile: java.io.File? = null
    private var isolatedCache: File? = null

    @After fun closeFixture() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
        cachedFile?.delete()
        isolatedCache?.deleteRecursively()
        assertTrue("The artwork fixture should stop", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("Artwork fixture failed", it) }
    }

    @Test fun freshCircleCacheAvoidsNetworkWhileOversizedArtworkFallsBack() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val freshURL = java.net.URL("http://127.0.0.1:${server.localPort}/uploads-circle/fresh-fixture.png")
        val freshPng = png()
        val digest = MessageDigest.getInstance("SHA-256").digest(freshURL.toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
        cachedFile = java.io.File(context.cacheDir, "circle-artwork/$digest").also {
            it.parentFile?.mkdirs()
            it.writeBytes(freshPng)
            it.setLastModified(System.currentTimeMillis())
        }

        val disconnected = CountDownLatch(1)
        val bytesRead = AtomicInteger()
        val prefix = png()
        val payloadSize = 8 * 1024 * 1024
        val oversizedURL = URL(null, "http://127.0.0.1:${server.localPort}/avatar/oversized-fixture.png", object : URLStreamHandler() {
            override fun openConnection(url: URL): URLConnection = object : HttpURLConnection(url) {
                override fun connect() = Unit
                override fun usingProxy() = false
                override fun getResponseCode() = 200
                override fun disconnect() { disconnected.countDown() }
                override fun getInputStream(): InputStream = object : InputStream() {
                    private var offset = 0
                    override fun read(): Int {
                        if (offset >= payloadSize) return -1
                        val result = if (offset < prefix.size) prefix[offset].toInt() and 255 else 0
                        offset++
                        bytesRead.incrementAndGet()
                        return result
                    }
                    override fun read(buffer: ByteArray, start: Int, length: Int): Int {
                        if (offset >= payloadSize) return -1
                        val count = minOf(length, payloadSize - offset)
                        for (i in 0 until count) buffer[start + i] = if (offset + i < prefix.size) prefix[offset + i] else 0
                        offset += count
                        bytesRead.addAndGet(count)
                        return count
                    }
                }
            }
        })
        compose.setContent {
            MaterialTheme {
                Column {
                    RemoteArtwork(freshURL, null, "Fresh Circle", 64.dp)
                    RemoteArtwork(oversizedURL, null, "Oversized Circle", 64.dp)
                }
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Fresh Circle image").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("O", substring = false).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Fresh Circle image").assertIsDisplayed()
        compose.onNodeWithText("O", substring = false).assertIsDisplayed()
        compose.onNodeWithContentDescription("Oversized Circle image").assertDoesNotExist()
        assertTrue("Artwork decoding must release the oversized response", disconnected.await(10, TimeUnit.SECONDS))
        compose.waitForIdle()
        assertTrue("Reading must stop at the size limit plus one buffer", bytesRead.get() in (2 * 1024 * 1024 + 1)..(2 * 1024 * 1024 + 8192))
        compose.onNodeWithContentDescription("Oversized Circle image").assertDoesNotExist()
        assertTrue("A fresh circle snapshot should avoid the local server", requestedPaths.isEmpty())
    }

    @Test fun circleArtworkCacheKeepsTheTwentyFourMostRecentImages() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val cacheRoot = java.nio.file.Files.createTempDirectory(context.cacheDir.toPath(), "fictional-circle-cache-").toFile()
        isolatedCache = cacheRoot
        val scopedContext = object : ContextWrapper(context) {
            override fun getCacheDir(): File = cacheRoot
            override fun getApplicationContext(): Context = this
        }
        val directory = File(cacheRoot, "circle-artwork").apply { mkdirs() }
        val oldestTime = System.currentTimeMillis() - 60_000
        val originalNames = (0 until 30).map { index ->
            File(directory, "fictional-image-$index").apply {
                writeBytes(png())
                assertTrue("Fixture timestamps must preserve cache order", setLastModified(oldestTime + index * 1_000))
            }.name
        }
        val url = URL("http://127.0.0.1:${server.localPort}/uploads-circle/new-fixture.png")
        val digest = MessageDigest.getInstance("SHA-256").digest(url.toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
        respondWithImage()
        compose.setContent {
            CompositionLocalProvider(LocalContext provides scopedContext) {
                MaterialTheme { RemoteArtwork(url, null, "Newest Circle", 64.dp) }
            }
        }
        compose.waitUntil(10_000) {
            File(directory, digest).exists() && directory.listFiles()?.size == 24 &&
                compose.onAllNodesWithContentDescription("Newest Circle image").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals((originalNames.drop(7) + digest).toSet(), directory.listFiles()?.map { it.name }?.toSet())
        assertEquals(listOf("/uploads-circle/new-fixture.png"), requestedPaths.toList())
    }

    @Test fun hostResultLoadsAvatarForKnownMemberAndSuppressesBlankTagline() {
        respondWithImage()
        val session = MemberSession(
            "connect.sid=fictional-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        compose.setContent {
            MaterialTheme {
                HostResultCard(
                    offer = HostOffer(
                        "offer-one",
                        "yes",
                        null,
                        null,
                        MessageMember("member-two", "quiet-fox", "Quiet Fox"),
                    ),
                    profile = MemberProfile(
                        null,
                        "quiet-fox",
                        "Quiet Fox",
                        "   ",
                        null,
                        null,
                        languages = emptyList(),
                    ),
                    sharedCircleIDs = emptySet(),
                    isMeet = false,
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    onClose = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Quiet Fox image").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Quiet Fox image").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        val textContent = compose.onAllNodes(
            SemanticsMatcher("text semantics") { it.config.contains(SemanticsProperties.Text) },
            useUnmergedTree = true,
        ).fetchSemanticsNodes().flatMap { node ->
            node.config[SemanticsProperties.Text].map { it.text }
        }
        assertFalse("Whitespace-only profile taglines should not become visible text", textContent.any { it.isBlank() })
        responder?.join(2_000)

        assertEquals(listOf("/api/users/member-two/avatar?size=64"), requestedPaths.toList())
        assertEquals("connect.sid=fictional-session", receivedCookie.get())
    }

    private fun respondWithImage() {
        val image = png()
        startResponder { socket ->
            val output = socket.getOutputStream()
            output.write(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${image.size}\r\nConnection: close\r\n\r\n".toByteArray(),
            )
            output.write(image)
            output.flush()
        }
    }

    private fun startResponder(respond: (Socket) -> Unit) {
        responder = thread(isDaemon = true, name = "artwork-edge-fixture") {
            try {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    return@thread
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                activeSocket.set(socket)
                try {
                    socket.soTimeout = 5_000
                    socket.use {
                        val input = socket.getInputStream()
                        val line = readLine(input).orEmpty()
                        requestedPaths += line.substringAfter(' ').substringBefore(' ')
                        var cookie: String? = null
                        while (true) {
                            val header = readLine(input) ?: break
                            if (header.isEmpty()) break
                            if (header.startsWith("Cookie:", ignoreCase = true)) {
                                cookie = header.substringAfter(':').trim()
                            }
                        }
                        receivedCookie.set(cookie)
                        respond(socket)
                    }
                } finally {
                    activeSocket.compareAndSet(socket, null)
                }
            } catch (error: IOException) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            } finally {
                activeSocket.getAndSet(null)?.close()
            }
        }
    }

    private fun readLine(input: java.io.InputStream): String? {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val next = input.read()
            if (next < 0) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            if (next == '\n'.code) {
                val line = bytes.toByteArray()
                val length = if (line.lastOrNull() == '\r'.code.toByte()) line.size - 1 else line.size
                return String(line, 0, length, Charsets.US_ASCII)
            }
            bytes.write(next)
        }
    }

    private fun png(): ByteArray = ByteArrayOutputStream().use { output ->
        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.GREEN)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }
}
