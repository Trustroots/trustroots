package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.URL
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RemoteArtworkAvatarJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val receivedCookie = AtomicReference<String>()
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    @Test fun loadsAnAvatarWithTheMemberSessionCookie() {
        responder = thread(isDaemon = true) {
            val socket = acceptOrStop() ?: return@thread
            socket.use {
                val input = socket.getInputStream().bufferedReader()
                input.readLine()
                while (true) {
                    val header = input.readLine() ?: break
                    if (header.isEmpty()) break
                    if (header.startsWith("Cookie:", true)) receivedCookie.set(header.substringAfter(':').trim())
                }
                val png = ByteArrayOutputStream().also { output ->
                    Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
                        .compress(Bitmap.CompressFormat.PNG, 100, output)
                }.toByteArray()
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${png.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().write(png)
                socket.getOutputStream().flush()
            }
        }
        val avatarUrl = URL("http://127.0.0.1:${server.localPort}/avatar-fixture.png")
        compose.setContent {
            androidx.compose.material3.MaterialTheme {
                RemoteArtwork(
                    url = avatarUrl,
                    sessionCookie = "connect.sid=fictional-session",
                    label = "Quiet Fox",
                    size = 64.dp,
                )
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Quiet Fox image").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Quiet Fox image").assertIsDisplayed()
        assertTrue(receivedCookie.get() == "connect.sid=fictional-session")
        responder?.join(1_000)
    }
}
