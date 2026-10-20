package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
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
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.experience.CreateExperienceScreen

@RunWith(AndroidJUnit4::class)
class CreateExperienceCancelJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val request = AtomicReference<CapturedRequest?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val releaseResponse = CountDownLatch(1)
    private var responder: Thread? = null

    @After fun stopFixture() {
        releaseResponse.countDown()
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(2_000)
        assertTrue("The experience fixture should stop", responder?.isAlive != true)
        responderFailure.get()?.let { throw AssertionError("The experience fixture failed", it) }
    }

    @Test fun dirtyExperienceCancelKeepsEditsUntilDiscardIsConfirmed() {
        val returnedToProfile = mutableStateOf(false)
        compose.setContent {
            if (returnedToProfile.value) {
                androidx.compose.material3.Text("Profile restored")
            } else {
                CreateExperienceScreen(
                    api = api(),
                    session = session(),
                    memberID = "member-two",
                    memberLabel = "Quiet Fox",
                    onSessionInvalidated = {},
                    onBack = { returnedToProfile.value = true },
                    onCreated = { returnedToProfile.value = true },
                )
            }
        }

        compose.onNodeWithText("Public experience (optional)")
            .performTextReplacement("A fictional shared journey.")
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("Public experience (optional)")
            .assertTextContains("A fictional shared journey.")
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Discard changes").performClick()

        compose.onNodeWithText("Profile restored").assertIsDisplayed()
    }

    @Test fun systemBackCannotLeaveExperienceWhileSaveIsPending() {
        startResponder()
        val returnedToProfile = mutableStateOf(false)
        compose.setContent {
            if (returnedToProfile.value) {
                androidx.compose.material3.Text("Profile restored")
            } else {
                CreateExperienceScreen(
                    api = api(),
                    session = session(),
                    memberID = "member-two",
                    memberLabel = "Quiet Fox",
                    onSessionInvalidated = {},
                    onBack = { returnedToProfile.value = true },
                    onCreated = { returnedToProfile.value = true },
                )
            }
        }

        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { request.get() != null }
        compose.onNodeWithContentDescription("Cancel").assertIsNotEnabled()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        compose.onNodeWithText("Experience with Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Profile restored").assertDoesNotExist()

        releaseResponse.countDown()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Profile restored").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Profile restored").assertIsDisplayed()
        responder?.join(2_000)
        assertEquals("POST", request.get()?.method)
        assertEquals("/api/experiences", request.get()?.path)
    }

    private fun session() = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )

    private fun api() = MobileApiClient("http://127.0.0.1:${server.localPort}")

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "experience-cancel-fixture") {
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
                    socket.soTimeout = 10_000
                    socket.use {
                        val input = socket.getInputStream()
                        val requestLine = readLine(input).orEmpty()
                        var contentLength = 0
                        while (true) {
                            val header = readLine(input) ?: break
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                        }
                        readBody(input, contentLength)
                        request.set(
                            CapturedRequest(
                                requestLine.substringBefore(' '),
                                requestLine.substringAfter(' ').substringBefore(' '),
                            ),
                        )
                        if (!releaseResponse.await(10, TimeUnit.SECONDS)) {
                            throw IOException("Test did not release the pending experience response")
                        }
                        val response = "{}".toByteArray(Charsets.UTF_8)
                        val output = socket.getOutputStream()
                        output.write(
                            "HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        output.write(response)
                        output.flush()
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
            if (next < 0) {
                return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
            }
            if (next == '\n'.code) {
                val line = bytes.toByteArray()
                val length = if (line.lastOrNull() == '\r'.code.toByte()) line.size - 1 else line.size
                return String(line, 0, length, Charsets.US_ASCII)
            }
            bytes.write(next)
        }
    }

    private fun readBody(input: java.io.InputStream, contentLength: Int) {
        val body = ByteArray(contentLength)
        var offset = 0
        while (offset < contentLength) {
            val count = input.read(body, offset, contentLength - offset)
            if (count < 0) throw IOException("Request body ended before Content-Length")
            offset += count
        }
    }

    private data class CapturedRequest(val method: String, val path: String)
}
