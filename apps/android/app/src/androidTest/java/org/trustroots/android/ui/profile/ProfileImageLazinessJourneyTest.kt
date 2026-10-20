package org.trustroots.android.ui.profile

import android.graphics.Bitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.FileInputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import java.util.Random
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class ProfileImageLazinessJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val server = ServerSocket(0).apply { soTimeout = 250 }
    private val requests = CopyOnWriteArrayList<ObservedRequest>()
    private val fixtureFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @After fun closeServer() {
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        assertTrue("Anonymous profile image fixture should stop after shutdown", responder?.isAlive != true)
        fixtureFailure.get()?.let { throw AssertionError("Profile image fixture failed", it) }
    }

    @Test fun requests2048AvatarOnlyAfterTapWithSessionAndRestoresProfileSectionOnClose() {
        val random = Random(7)
        val pixels = IntArray(1024 * 1024) { random.nextInt() or -0x1000000 }
        val imageBytes = Bitmap.createBitmap(pixels, 1024, 1024, Bitmap.Config.ARGB_8888).let(::pngBytes)
        assertTrue("Largest avatars may exceed the thumbnail download budget", imageBytes.size > 2 * 1024 * 1024)
        assertTrue("The fixture fits the server's avatar response budget", imageBytes.size <= 8 * 1024 * 1024)
        responder = thread(isDaemon = true, name = "anonymous-profile-image-fixture") {
            serveRequests(imageBytes)
        }
        val session = MemberSession(
            "connect.sid=fictional-profile-session",
            MobileMember("steady-heron", "Steady Heron"),
        )

        compose.setContent {
            MemberProfileScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = session,
                username = "quiet-fox",
                onSessionInvalidated = {},
                onBack = {},
            )
        }

        compose.waitUntil(10_000) {
            requests.any { it.path == "/api/users/quiet-fox" } &&
                requests.any { it.path == "/api/users/member-main/avatar?size=512" } &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        assertFalse(requests.any { it.path == "/api/users/member-main/avatar?size=2048" })

        compose.onNodeWithTag("profileSection-contacts").performClick()
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
        compose.onNodeWithTag("profileAvatar").performClick()
        compose.waitUntil(10_000) {
            requests.any { it.path == "/api/users/member-main/avatar?size=2048" } &&
                compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithContentDescription("Profile photo of Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        val fullSizeRequest = requests.single { it.path == "/api/users/member-main/avatar?size=2048" }
        assertEquals(session.cookieHeader, fullSizeRequest.cookie)
        compose.onNodeWithContentDescription("Profile photo of Quiet Fox").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close profile photo").performClick()
        assertTrue(compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()

        compose.onNodeWithTag("profileAvatar").performClick()
        compose.onNodeWithContentDescription("Profile photo of Quiet Fox").assertIsDisplayed()
        InstrumentationRegistry.getInstrumentation().uiAutomation
            .executeShellCommand("input keyevent KEYCODE_BACK").use { descriptor ->
                FileInputStream(descriptor.fileDescriptor).use { it.readBytes() }
            }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithTag("profileImageViewer").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithTag("profileSection-contacts").assertIsSelected()
        assertEquals(1, requests.count { it.path == "/api/users/member-main/avatar?size=2048" })
    }

    private fun serveRequests(imageBytes: ByteArray) {
        val thumbnailBytes = pngBytes(Bitmap.createBitmap(4, 3, Bitmap.Config.ARGB_8888))
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
                        if (header.startsWith("Cookie:", ignoreCase = true)) {
                            cookie = header.substringAfter(':').trim()
                        }
                    }
                    val path = requestLine.substringAfter(' ').substringBefore(' ')
                    requests += ObservedRequest(path, cookie)
                    val (status, contentType, body) = when (path) {
                        "/api/users/quiet-fox" -> Triple(
                            "200 OK",
                            "application/json",
                            """{"_id":"member-main","username":"quiet-fox","displayName":"Quiet Fox"}""".toByteArray(),
                        )
                        "/api/offers-by/member-main?types=host",
                        "/api/contacts/member-main",
                        "/api/experiences?userTo=member-main" -> Triple("200 OK", "application/json", "[]".toByteArray())
                        "/api/contact-by/member-main" -> Triple("404 Not Found", "application/json", "{}".toByteArray())
                        "/api/users/member-main/avatar?size=512" -> Triple("200 OK", "image/png", thumbnailBytes)
                        "/api/users/member-main/avatar?size=2048" -> Triple("200 OK", "image/png", imageBytes)
                        else -> Triple("404 Not Found", "application/json", "{}".toByteArray())
                    }
                    connection.getOutputStream().apply {
                        write(
                            "HTTP/1.1 $status\r\nContent-Type: $contentType\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(body)
                        flush()
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) {
                    fixtureFailure.compareAndSet(null, IOException("Anonymous profile image fixture failed", error))
                    return
                }
            } finally {
                activeSocket = null
            }
        }
    }

    private data class ObservedRequest(val path: String, val cookie: String?)

    private fun pngBytes(bitmap: Bitmap): ByteArray = ByteArrayOutputStream().use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        bitmap.recycle()
        output.toByteArray()
    }
}
