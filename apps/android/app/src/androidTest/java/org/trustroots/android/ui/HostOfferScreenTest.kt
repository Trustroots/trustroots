package org.trustroots.android.ui

import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.testing.KeyboardTestSupport
import org.trustroots.android.testing.foregroundActivityTask
import org.trustroots.android.ui.hostoffer.HostOfferScreen

@RunWith(AndroidJUnit4::class)
class HostOfferScreenTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val saveBodies = CopyOnWriteArrayList<String>()
    private lateinit var keyboardTestSupport: KeyboardTestSupport

    @Before fun configureEdgeToEdgeWindow() {
        keyboardTestSupport = KeyboardTestSupport(InstrumentationRegistry.getInstrumentation().uiAutomation, compose.activity)
        compose.runOnUiThread {
            WindowCompat.setDecorFitsSystemWindows(compose.activity.window, false)
            compose.activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    @After fun closeServer() {
        keyboardTestSupport.close()
        server.close()
    }

    @Test fun validatesDraftAndSavesByTouchWhileImeIsOpen() {
        val responder = thread(isDaemon = true) {
            repeat(6) {
                val connection = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine().orEmpty()
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    val requestBody = if (contentLength > 0) {
                        CharArray(contentLength).also { buffer ->
                            var offset = 0
                            while (offset < buffer.size) {
                                val count = input.read(buffer, offset, buffer.size - offset)
                                if (count < 0) break
                                offset += count
                            }
                        }.concatToString()
                    } else ""
                    if (request.startsWith("PUT ")) saveBodies += requestBody
                    val payload = when {
                        request.startsWith("PUT ") ->
                            """{"_id":"offer-one","status":"yes","description":"A quiet corner for guests.","maxGuests":2,"showOnlyInMyCircles":false,"location":[48.69,9.14]}"""
                        request.contains("/api/offers-by/") ->
                            """[{"_id":"offer-one","status":"yes","description":"<p>The hosting space is a quiet sleeping corner in the front room, with clean bedding, a reading lamp, a shelf for belongings, access to a shared kitchen, and a short walk to the town centre. Guests can arrive in the evening and have a key during their stay. Please bring a sleeping bag in winter, and let me know about accessibility needs before arriving. There is room for one or two guests and a small bag. The neighbourhood is calm overnight, with a bus stop and supermarket nearby. We can share breakfast in the kitchen, and there is a sheltered place to leave wet shoes. Please message before travelling if your arrival time changes.</p>","maxGuests":2,"showOnlyInMyCircles":false,"location":[48.69,9.14]}]"""
                        request.contains("/api/users/") ->
                            """{"_id":"member-one","username":"river-otter","displayName":"River Otter"}"""
                        else -> "{}"
                    }
                    val body = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(body)
                }
            }
        }
        compose.setContent {
            HostOfferScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                onSessionInvalidated = {},
                onBack = {},
            )
        }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("quiet sleeping corner", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Host").assertIsDisplayed()
        compose.onNodeWithText("quiet sleeping corner", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Save changes").assertIsDisplayed()

        val descriptionBottom = compose.onNodeWithText("Hosting description").fetchSemanticsNode().boundsInRoot.bottom
        val guestsTop = compose.onNodeWithText("Maximum guests").fetchSemanticsNode().boundsInRoot.top
        val minimumGap = with(compose.density) { 12.dp.toPx() }
        org.junit.Assert.assertTrue("Adjacent hosting fields should have a consistent gap", guestsTop - descriptionBottom >= minimumGap)

        foregroundActivityTask(compose, compose.activity, InstrumentationRegistry.getInstrumentation().uiAutomation)
        compose.onNodeWithText("Maximum guests").performScrollTo().performClick()
        compose.onNodeWithText("Maximum guests").performTextReplacement("3")
        keyboardTestSupport.awaitShown(compose)
        compose.onNodeWithText("Maximum guests").performScrollTo()
        assertAboveIme("Maximum guests")
        assertAboveIme("Save changes")
        compose.onNodeWithText("3").assertIsDisplayed()
        pressImeBack()
        compose.onNodeWithText("3").assertIsDisplayed()
        compose.onNodeWithText("Discard", substring = true).assertDoesNotExist()

        compose.onNodeWithText("Hosting description").performScrollTo().performClick()
        compose.onNodeWithText("Hosting description").performTextReplacement("Room")
        keyboardTestSupport.awaitShown(compose)
        compose.onNodeWithText("Hosting description").performScrollTo()
        assertAboveIme("Hosting description")
        assertAboveIme("Save changes")
        compose.onNodeWithText("Write a longer hosting description first.").assertIsDisplayed()
        assertEquals("Room", compose.onNodeWithText("Hosting description")
            .fetchSemanticsNode().config[SemanticsProperties.EditableText].text)
        compose.onNodeWithText("Save changes").assertIsNotEnabled()

        compose.onNodeWithText("Hosting description").performTextReplacement("A quiet corner for guests.")
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Write a longer hosting description first.").fetchSemanticsNodes().isEmpty()
        }
        keyboardTestSupport.awaitShown(compose)
        compose.onNodeWithText("Hosting description").performScrollTo()
        assertAboveIme("Hosting description")
        assertAboveIme("Save changes")
        val saveButton = compose.onNodeWithText("Save changes")
        val saveBounds = saveButton.fetchSemanticsNode().touchBoundsInRoot
        with(compose.density) {
            assertTrue("Save action width should provide a 48dp touch target", saveBounds.width.toDp() >= 48.dp)
            assertTrue("Save action height should provide a 48dp touch target", saveBounds.height.toDp() >= 48.dp)
        }
        saveButton.performTouchInput { click() }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Hosting offer saved.").assertIsDisplayed()
        compose.waitUntil(5_000) { saveBodies.size == 1 }
        assertTrue(
            "The saved request should contain the valid draft",
            saveBodies.single().contains("\"description\":\"A quiet corner for guests.\""),
        )
        responder.join(1_000)
    }

    private var imeGeometry = "No keyboard geometry recorded"

    private fun assertAboveIme(text: String) {
        try {
            compose.waitUntil(5_000) { isAboveIme(text) }
        } catch (error: ComposeTimeoutException) {
            throw AssertionError("$text should remain above the open keyboard: $imeGeometry", error)
        }
        compose.onNodeWithText(text).assertIsDisplayed()
        assertTrue("$text should remain above the open keyboard", isAboveIme(text))
    }

    private fun isAboveIme(text: String): Boolean {
        val decor = compose.activity.window.decorView
        val imeBounds = keyboardTestSupport.imeBoundsOnScreen()
        val viewTop = decor.locationOnScreenY()
        imeGeometry = "windowTop=$viewTop windowHeight=${decor.height} imeBounds=$imeBounds ${keyboardTestSupport.windowDiagnostics}"
        if (imeBounds == null) return false
        val bounds = compose.onNodeWithText(text).getUnclippedBoundsInRoot()
        val top = with(compose.density) { bounds.top.toPx() }
        val bottom = with(compose.density) { bounds.bottom.toPx() }
        imeGeometry += " fieldTop=${top + viewTop} fieldBottom=${bottom + viewTop}"
        return top + viewTop >= 0 && bottom + viewTop <= imeBounds.top
    }

    private fun pressImeBack() {
        InstrumentationRegistry.getInstrumentation().uiAutomation
            .executeShellCommand("input keyevent KEYCODE_BACK").close()
        compose.waitUntil(5_000) { keyboardTestSupport.imeBoundsOnScreen() == null }
    }

    private fun android.view.View.locationOnScreenY(): Int = IntArray(2).let { getLocationOnScreen(it); it[1] }
}
