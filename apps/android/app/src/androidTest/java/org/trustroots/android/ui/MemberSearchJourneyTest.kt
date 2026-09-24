package org.trustroots.android.ui

import android.graphics.Bitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertEquals
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class MemberSearchJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun searchesAndOpensMemberProfile() {
        val responder = thread(isDaemon = true) {
            repeat(12) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val payload = when {
                        request.contains("/api/users?") -> """[{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}]"""
                        request.contains("/api/offers-by/") -> """[{"status":"yes","description":"<p>Spare <strong>room</strong></p>","maxGuests":2}]"""
                        request.contains("/api/contacts/") -> """[{"_id":"contact-one","user":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"}}]"""
                        request.contains("/api/experiences?") -> """[{"_id":"reference-one","userFrom":{"_id":"member-two","username":"calm-lynx","displayName":"Calm Lynx"},"feedbackPublic":"A thoughtful guest","recommend":"yes"}]"""
                        else -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Travelling slowly","description":"<p>Hosting <strong>travellers</strong></p>","languages":["eng","por"]}"""
                    }
                    val bytes = if (request.contains("/avatar?")) {
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
            SearchHubScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                initialTab = 1,
            )
        }
        compose.onNodeWithText("Members").assertIsDisplayed()
        compose.onNodeWithText("Name or username").performTextInput("quiet fox")
        compose.onNodeWithText("Search").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Quiet Fox").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Travelling slowly").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Travelling slowly").assertIsDisplayed()
        compose.onNodeWithText("Members").assertDoesNotExist()
        compose.onNodeWithText("Hosts map").assertDoesNotExist()
        val profileHero = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot
        val screen = compose.onRoot().fetchSemanticsNode().boundsInRoot
        assertEquals(screen.left, profileHero.left, 1f)
        assertEquals(screen.right, profileHero.right, 1f)
        compose.waitUntil(10_000) {
            compose.onAllNodesWithContentDescription("Quiet Fox image").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Quiet Fox image").assertIsDisplayed()
        compose.onNodeWithText("Hosting", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithText("Spare room").assertIsDisplayed()
        compose.onNodeWithText("Languages: English, Portuguese").assertIsDisplayed()
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithText("References").assertIsDisplayed()
        compose.onNodeWithText("A thoughtful guest").assertIsDisplayed()
        compose.onNodeWithText("‹ Back").performClick()
        compose.onNodeWithText("Members").assertIsDisplayed()
        responder.join(1_000)
    }
}
