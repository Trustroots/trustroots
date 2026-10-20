package org.trustroots.android.ui

import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class CreateExperienceScreenTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)

    @Before fun configureEdgeToEdgeWindow() {
        compose.runOnUiThread {
            WindowCompat.setDecorFitsSystemWindows(compose.activity.window, false)
            compose.activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    @After fun closeServer() = server.close()

    @Test fun sharesExperienceWithMember() {
        val posted = AtomicReference("")
        val created = AtomicBoolean(false)
        thread(isDaemon = true) {
            repeat(4) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    if (request.startsWith("POST ")) {
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) break
                            offset += count
                        }
                        posted.set(body.concatToString(0, offset))
                    }
                    val payload = """{"_id":"experience-one"}"""
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        compose.setContent {
            CreateExperienceScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("river-otter", "River Otter")),
                memberID = "member-two",
                memberLabel = "Calm Lynx",
                onSessionInvalidated = {},
                onBack = {},
                onCreated = { created.set(true) },
            )
        }
        compose.onNodeWithText("Experience with Calm Lynx").assertIsDisplayed()
        compose.onNodeWithText("Public experience (optional)").performScrollTo().performClick()
        compose.onNodeWithText("Public experience (optional)").performTextInput("A fictional account of a kind visit.")
        compose.onNodeWithText("Public experience (optional)").performScrollTo()
        assertAboveIme("Public experience (optional)")
        assertAboveIme("Save changes")
        compose.onNodeWithText("A fictional account of a kind visit.", substring = true).assertIsDisplayed()
        pressImeBack()
        compose.onNodeWithText("A fictional account of a kind visit.", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Discard", substring = true).assertDoesNotExist()
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(5_000) { created.get() }
        assertTrue(posted.get().contains("\"userTo\":\"member-two\""))
        assertTrue(posted.get().contains("\"met\":true"))
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
        val imeBottom = ViewCompat.getRootWindowInsets(decor)
            ?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0
        val viewTop = decor.locationOnScreenY()
        val keyboardTop = viewTop + decor.height - imeBottom
        imeGeometry = "windowTop=$viewTop windowHeight=${decor.height} imeBottom=$imeBottom keyboardTop=$keyboardTop"
        if (imeBottom == 0) return false
        val bounds = compose.onNodeWithText(text).getUnclippedBoundsInRoot()
        val top = with(compose.density) { bounds.top.toPx() }
        val bottom = with(compose.density) { bounds.bottom.toPx() }
        imeGeometry += " fieldTop=${top + viewTop} fieldBottom=${bottom + viewTop}"
        return top + viewTop >= 0 && bottom + viewTop <= keyboardTop
    }

    private fun pressImeBack() {
        InstrumentationRegistry.getInstrumentation().uiAutomation
            .executeShellCommand("input keyevent KEYCODE_BACK").close()
        compose.waitUntil(5_000) {
            ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
                ?.getInsets(WindowInsetsCompat.Type.ime())?.bottom == 0
        }
    }

    private fun android.view.View.locationOnScreenY(): Int = IntArray(2).let { getLocationOnScreen(it); it[1] }
}
