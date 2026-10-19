package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.common.ArtworkHero

@RunWith(AndroidJUnit4::class)
class ArtworkSessionCacheJourneyTest {
    @get:Rule val compose = createComposeRule()

    private val server = ServerSocket(0).apply { soTimeout = 250 }
    private val requests = CopyOnWriteArrayList<ImageRequest>()
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null

    @After fun closeServer() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            runCatching { server.close() }
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder?.join(2_000)
            assertTrue("The local image server should stop", responder?.isAlive != true)
            responderFailure.get()?.let { throw AssertionError("The local image server failed", it) }
        }
    }

    @Test fun avatarAndHeroShareCookieScopedArtworkCache() {
        val redPNG = png(android.graphics.Color.RED)
        val bluePNG = png(android.graphics.Color.BLUE)
        startImageServer(redPNG, bluePNG)
        val url = URL("http://127.0.0.1:${server.localPort}/avatar-fixture-unique.png")

        compose.setContent {
            MaterialTheme {
                var cookie by remember { mutableStateOf(FIRST_COOKIE) }
                var showHero by remember { mutableStateOf(false) }
                Column {
                    Row {
                        Button(onClick = { cookie = if (cookie == FIRST_COOKIE) SECOND_COOKIE else FIRST_COOKIE }) {
                            Text(if (cookie == FIRST_COOKIE) "Use second cookie" else "Use first cookie")
                        }
                        Button(onClick = { showHero = !showHero }) {
                            Text(if (showHero) "Show avatar" else "Show hero")
                        }
                    }
                    if (showHero) {
                        ArtworkHero(
                            url = url,
                            sessionCookie = cookie,
                            label = "Fictional member",
                            subtitle = "A fictional profile",
                            background = Color.DarkGray,
                            blurBackground = false,
                            testTag = "fixtureArtworkHero",
                        )
                    } else {
                        RemoteArtwork(url, cookie, "Fictional member", 96.dp)
                    }
                }
            }
        }

        awaitArtwork(hero = false, red = true)
        assertEquals(1, requests.size)
        assertEquals(ImageRequest(IMAGE_PATH, FIRST_COOKIE), requests.single())

        compose.onNodeWithText("Show hero").performClick()
        awaitArtwork(hero = true, red = true)
        assertEquals("ArtworkHero should reuse RemoteArtwork's cached image", 1, requests.size)

        compose.onNodeWithText("Use second cookie").performClick()
        awaitArtwork(hero = true, red = false)
        assertEquals(2, requests.size)
        assertEquals(ImageRequest(IMAGE_PATH, SECOND_COOKIE), requests.last())

        compose.onNodeWithText("Show avatar").performClick()
        awaitArtwork(hero = false, red = false)
        assertEquals("RemoteArtwork should reuse ArtworkHero's cached image", 2, requests.size)

        compose.onNodeWithText("Use first cookie").performClick()
        awaitArtwork(hero = false, red = true)
        assertEquals("Returning to the first cookie should use its cached artwork", 2, requests.size)
        assertEquals(
            listOf(ImageRequest(IMAGE_PATH, FIRST_COOKIE), ImageRequest(IMAGE_PATH, SECOND_COOKIE)),
            requests.toList(),
        )
    }

    private fun awaitArtwork(hero: Boolean, red: Boolean) {
        if (hero) {
            compose.waitUntil(10_000) {
                compose.onAllNodesWithTag("fixtureArtworkHero").fetchSemanticsNodes().isNotEmpty() &&
                    hasExpectedDominantColour(
                        compose.onNodeWithTag("fixtureArtworkHero").captureToImage().toPixelMap()
                            .let { it[it.width / 2, 1] },
                        red,
                    )
            }
            compose.onNodeWithTag("fixtureArtworkHero").assertIsDisplayed()
        } else {
            compose.waitUntil(10_000) {
                compose.onAllNodesWithContentDescription("Fictional member image")
                    .fetchSemanticsNodes().isNotEmpty() &&
                    runCatching {
                        hasExpectedDominantColour(
                            compose.onNodeWithContentDescription("Fictional member image")
                                .captureToImage().toPixelMap()
                                .let { it[it.width / 2, it.height / 2] },
                            red,
                        )
                    }.getOrDefault(false)
            }
            compose.onNodeWithContentDescription("Fictional member image").assertIsDisplayed()
        }
    }

    private fun hasExpectedDominantColour(colour: Color, red: Boolean): Boolean =
        if (red) colour.red > colour.blue * 2 && colour.red > colour.green * 2
        else colour.blue > colour.red * 2 && colour.blue > colour.green * 2

    private fun startImageServer(redPNG: ByteArray, bluePNG: ByteArray) {
        responder = thread(isDaemon = true, name = "fictional-avatar-image-server") {
            try {
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
                            connection.soTimeout = 5_000
                            val input = connection.getInputStream().bufferedReader(Charsets.US_ASCII)
                            val requestLine = input.readLine() ?: throw EOFException("Missing image request line")
                            var cookie: String? = null
                            while (true) {
                                val header = input.readLine() ?: throw EOFException("Incomplete image request headers")
                                if (header.isEmpty()) break
                                if (header.startsWith("Cookie:", ignoreCase = true)) {
                                    cookie = header.substringAfter(':').trim()
                                }
                            }
                            val path = requestLine.substringAfter(' ').substringBefore(' ')
                            requests += ImageRequest(path, cookie)
                            val image = when (cookie) {
                                FIRST_COOKIE -> redPNG
                                SECOND_COOKIE -> bluePNG
                                else -> throw IOException("Unexpected fictional avatar cookie: $cookie")
                            }
                            connection.getOutputStream().apply {
                                write(
                                    "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${image.size}\r\nConnection: close\r\n\r\n"
                                        .toByteArray(Charsets.US_ASCII),
                                )
                                write(image)
                                flush()
                            }
                        }
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                    }
                }
            } catch (error: Throwable) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            }
        }
    }

    private fun png(colour: Int): ByteArray = ByteArrayOutputStream().use { output ->
        val bitmap = Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(colour)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }

    private data class ImageRequest(val path: String, val cookie: String?)

    private companion object {
        const val IMAGE_PATH = "/avatar-fixture-unique.png"
        const val FIRST_COOKIE = "session=fictional-member-a"
        const val SECOND_COOKIE = "session=fictional-member-b"
    }
}
