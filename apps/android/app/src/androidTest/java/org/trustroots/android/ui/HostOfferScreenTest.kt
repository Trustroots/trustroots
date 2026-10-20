package org.trustroots.android.ui

import android.content.res.Resources
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.compose.ui.unit.dp
import java.net.ServerSocket
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
class HostOfferScreenTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)

    @Before fun configureEdgeToEdgeWindow() {
        compose.runOnUiThread {
            WindowCompat.setDecorFitsSystemWindows(compose.activity.window, false)
            compose.activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    @After fun closeServer() = server.close()

    @Test fun loadsExistingHostingOffer() {
        thread(isDaemon = true) {
            repeat(6) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
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

        compose.onNodeWithText("Maximum guests").performScrollTo().performClick()
        compose.onNodeWithText("Maximum guests").performTextReplacement("3")
        compose.onNodeWithText("Maximum guests").performScrollTo()
        assertAboveIme("Maximum guests")
        assertAboveIme("Save changes")
        compose.onNodeWithText("3").assertIsDisplayed()
        pressImeBack()
        compose.onNodeWithText("3").assertIsDisplayed()
        compose.onNodeWithText("Discard", substring = true).assertDoesNotExist()
    }

    private fun assertAboveIme(text: String) {
        compose.waitUntil(5_000) {
            isAboveIme(text)
        }
        compose.onNodeWithText(text).assertIsDisplayed()
        assertTrue("$text should remain above the open keyboard", isAboveIme(text))
    }

    private fun isAboveIme(text: String): Boolean {
        val imeBottom = ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
            ?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0
        if (imeBottom == 0) return false
        val keyboardTop = Resources.getSystem().displayMetrics.heightPixels - imeBottom
        val bounds = compose.onNodeWithText(text).getUnclippedBoundsInRoot()
        val top = with(compose.density) { bounds.top.toPx() }
        val bottom = with(compose.density) { bounds.bottom.toPx() }
        val viewTop = compose.activity.window.decorView.locationOnScreenY()
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
