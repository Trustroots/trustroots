package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLConnection
import java.net.URLStreamHandler
import java.util.concurrent.ConcurrentHashMap
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ArtworkRedirectJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun httpsRedirectLoadsImageAndForwardsCookieOnlyOnFirstHop() {
        val image = png()
        val fixture = FakeHttpsHandler { url ->
            when (url.path) {
                "/avatar/start" -> StubResponse(HttpURLConnection.HTTP_MOVED_TEMP, "/avatar/secure.png")
                "/avatar/secure.png" -> StubResponse(HttpURLConnection.HTTP_OK, bytes = image)
                else -> error("Unexpected fake URL: $url")
            }
        }
        val url = fixture.url("https://artwork-${UUID.randomUUID()}.example.invalid/avatar/start")
        compose.setContent {
            MaterialTheme {
                RemoteArtwork(url, "connect.sid=fictional-image-session", "Redirected Circle", 64.dp)
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Redirected Circle image").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Redirected Circle image").assertIsDisplayed()
        compose.waitUntil(5_000) { fixture.connections.size == 2 && fixture.connections.all { it.disconnected.get() } }
        assertEquals(listOf("/avatar/start", "/avatar/secure.png"), fixture.connections.map { URL(it.url).path })
        assertEquals("connect.sid=fictional-image-session", fixture.connections[0].cookie.get())
        assertNull(fixture.connections[1].cookie.get())
        assertEquals(listOf(302, 200), fixture.connections.map { it.status })
        assertEquals("/avatar/secure.png", fixture.connections[0].location)
        assertArrayEquals(image, fixture.connections[1].bytes)
        assertEquals("image/*", fixture.connections[0].headers["Accept"])
        assertEquals("image/*", fixture.connections[1].headers["Accept"])
        assertTrue("The custom HTTPS URL handler should handle each same-protocol redirect", fixture.connections.all { it.handledByFakeHttps })
    }

    @Test fun httpsRedirectLoopStopsAfterThreeAttemptsAndShowsPlaceholder() {
        val fixture = FakeHttpsHandler { url ->
            val next = when (url.path) {
                "/loop/a" -> "/loop/b"
                "/loop/b" -> "/loop/c"
                "/loop/c" -> "/loop/a"
                else -> error("Unexpected fake URL: $url")
            }
            StubResponse(HttpURLConnection.HTTP_MOVED_TEMP, next)
        }
        val url = fixture.url("https://loop-${UUID.randomUUID()}.example.invalid/loop/a")
        compose.setContent {
            MaterialTheme {
                ArtworkHero(url, "connect.sid=loop-session", "Looped Circle", "A fictional circle", Color.Blue, true, "loopHero")
            }
        }

        compose.waitUntil(10_000) {
            fixture.connections.size == 3 && fixture.connections.all { it.disconnected.get() }
        }
        compose.onNodeWithText("Looped Circle").assertIsDisplayed()
        compose.onNodeWithText("L").assertIsDisplayed()
        compose.onNodeWithContentDescription("Looped Circle image").assertDoesNotExist()
        assertEquals(listOf("/loop/a", "/loop/b", "/loop/c"), fixture.connections.map { URL(it.url).path })
        assertTrue(fixture.connections.all { it.status == 302 && it.location != null && it.bytes.isEmpty() })
        assertTrue(fixture.connections.all { it.handledByFakeHttps })
    }

    @Test fun missingLocationAndHttpDestinationKeepPlaceholdersWithoutFollowing() {
        val fixture = FakeHttpsHandler { url ->
            when (url.path) {
                "/redirect/missing-location" -> StubResponse(HttpURLConnection.HTTP_MOVED_TEMP)
                "/redirect/insecure-target" -> StubResponse(HttpURLConnection.HTTP_MOVED_TEMP, "http://unsafe.example.invalid/image.png")
                else -> error("Unexpected fake URL: $url")
            }
        }
        val missingLocationURL = fixture.url("https://missing-${UUID.randomUUID()}.example.invalid/redirect/missing-location")
        val insecureTargetURL = fixture.url("https://insecure-${UUID.randomUUID()}.example.invalid/redirect/insecure-target")
        compose.setContent {
            MaterialTheme {
                Column {
                    RemoteArtwork(missingLocationURL, null, "No Location", 64.dp)
                    RemoteArtwork(insecureTargetURL, null, "HTTP Target", 64.dp)
                }
            }
        }

        compose.waitUntil(10_000) {
            fixture.connections.size == 2 && fixture.connections.all { it.disconnected.get() }
        }
        compose.onNodeWithText("N").assertIsDisplayed()
        compose.onNodeWithText("H").assertIsDisplayed()
        compose.onNodeWithContentDescription("No Location image").assertDoesNotExist()
        compose.onNodeWithContentDescription("HTTP Target image").assertDoesNotExist()
        assertEquals(
            setOf("/redirect/missing-location", "/redirect/insecure-target"),
            fixture.connections.map { URL(it.url).path }.toSet(),
        )
        assertTrue(fixture.connections.all { it.status == 302 && it.bytes.isEmpty() })
        assertTrue(fixture.connections.any { it.location == null })
        assertTrue(fixture.connections.any { it.location == "http://unsafe.example.invalid/image.png" })
        assertTrue(fixture.connections.all { it.handledByFakeHttps })
    }

    private fun png(): ByteArray = ByteArrayOutputStream().use { output ->
        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(android.graphics.Color.GREEN)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }

    private data class StubResponse(
        val status: Int,
        val location: String? = null,
        val bytes: ByteArray = ByteArray(0),
    )

    private class ConnectionRecord(val url: String, response: StubResponse) {
        val status = response.status
        val location = response.location
        val bytes = response.bytes
        val headers = ConcurrentHashMap<String, String>()
        val cookie: AtomicReference<String?> = AtomicReference(null)
        val disconnected = AtomicBoolean(false)
        @Volatile var handledByFakeHttps = false
    }

    private class FakeHttpsHandler(private val respond: (URL) -> StubResponse) : URLStreamHandler() {
        val connections = CopyOnWriteArrayList<ConnectionRecord>()

        fun url(spec: String): URL = URL(null, spec, this)

        override fun openConnection(url: URL): URLConnection {
            val response = respond(url)
            val record = ConnectionRecord(url.toExternalForm(), response).also { it.handledByFakeHttps = true }
            connections += record
            return FakeConnection(url, response, record)
        }
    }

    private class FakeConnection(
        url: URL,
        private val response: StubResponse,
        private val record: ConnectionRecord,
    ) : HttpURLConnection(url) {
        override fun connect() {
            connected = true
        }

        override fun disconnect() {
            record.disconnected.set(true)
            connected = false
        }

        override fun usingProxy(): Boolean = false

        override fun getResponseCode(): Int = response.status

        override fun getHeaderField(name: String): String? =
            if (name.equals("Location", ignoreCase = true)) response.location else null

        override fun getInputStream() = ByteArrayInputStream(response.bytes)

        override fun setRequestProperty(key: String, value: String) {
            record.headers[key] = value
            if (key.equals("Cookie", ignoreCase = true)) record.cookie.set(value)
        }
    }
}
