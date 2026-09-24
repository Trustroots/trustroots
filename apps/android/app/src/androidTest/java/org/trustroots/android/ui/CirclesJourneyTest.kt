package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.test.platform.app.InstrumentationRegistry
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class CirclesJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun browsesAndJoinsCircle() {
        val circleArt = File(InstrumentationRegistry.getInstrumentation().targetContext.cacheDir, "circle-artwork")
        circleArt.deleteRecursively()
        val responder = thread {
            repeat(5) {
                server.accept().use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
                        request.contains("/api/tribes") -> """[{"_id":"circle-two","slug":"quiet","label":"Quiet Circle","count":3},{"_id":"circle-one","slug":"wanderers","label":"Wanderers","count":12,"image":true,"description":"Meet fellow travellers"}]"""
                        request.contains("/api/users/memberships/") -> "{}"
                        else -> "[]"
                    }
                    val bytes = if (request.contains("/uploads-circle/")) {
                        ByteArrayOutputStream().also { output ->
                            Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                                .compress(Bitmap.CompressFormat.PNG, 100, output)
                        }.toByteArray()
                    } else payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        compose.setContent {
            CirclesScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
            )
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Wanderers").fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Wanderers image").fetchSemanticsNodes().isNotEmpty()
        }
        val popularTop = compose.onNodeWithText("Wanderers").fetchSemanticsNode().boundsInRoot.top
        val quietTop = compose.onNodeWithText("Quiet Circle").fetchSemanticsNode().boundsInRoot.top
        assertTrue(popularTop < quietTop)
        compose.onNodeWithContentDescription("Wanderers image").assertIsDisplayed()
        assertTrue(circleArt.listFiles()?.isNotEmpty() == true)
        compose.onNodeWithContentDescription("Wanderers image").performClick()
        compose.onNodeWithText("Meet fellow travellers").assertIsDisplayed()
        val circleHero = compose.onNodeWithTag("circleHero").fetchSemanticsNode().boundsInRoot
        val screen = compose.onRoot().fetchSemanticsNode().boundsInRoot
        assertEquals(screen.left, circleHero.left, 1f)
        assertEquals(screen.right, circleHero.right, 1f)
        compose.onNodeWithText("Join circle").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Leave circle").fetchSemanticsNodes().isNotEmpty()
        }
        responder.join(1_000)
    }
}
