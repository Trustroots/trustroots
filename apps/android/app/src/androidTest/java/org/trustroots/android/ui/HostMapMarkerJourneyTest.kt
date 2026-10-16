package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.activity.ComponentActivity
import android.location.Address
import java.util.Locale
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostMapMarkerJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<String>()
    private var responder: Thread? = null
    @Volatile private var activeSocket: Socket? = null

    @After fun closeServer() {
        server.close()
        activeSocket?.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    @Test fun opensHostDetailsFromTheVisibleMapMarker() {
        responder = thread(isDaemon = true) {
            while (true) {
                val socket = acceptOrStop() ?: return@thread
                activeSocket = socket
                try {
                socket.use {
                    socket.soTimeout = 5_000
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    requests += request
                    val headers = mutableListOf<String>()
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        headers += header
                    }
                    val contentLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                        ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                    repeat(contentLength) {
                        if (input.read() < 0) throw java.io.EOFException("Incomplete fixture body")
                    }
                    val payload = when {
                        request.startsWith("GET /api/offers?") ->
                            """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
                        request.startsWith("GET /api/offers/offer-one") ->
                            """{"_id":"offer-one","status":"yes","description":"A fictional spare room.","maxGuests":2,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
                        request.startsWith("GET /api/users/quiet-fox") ->
                            """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A fictional host"}"""
                        request.startsWith("GET /api/users/memberships") -> "[]"
                        else -> "{}"
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
                } catch (error: java.io.IOException) {
                    if (!server.isClosed) throw error
                } finally {
                    activeSocket = null
                }
            }
        }
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, _ -> listOf(Address(Locale.UK).apply { setAddressLine(0, "Fictional destination") }) },
            )
        }

        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("A fictional spare room.").assertIsDisplayed()
        compose.onNodeWithText("Hosting travellers").assertIsDisplayed()
        check(requests.any { it.startsWith("GET /api/offers/offer-one ") })

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("A fictional spare room.").assertDoesNotExist()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Hosting").assertDoesNotExist()

        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional")
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Fictional destination").fetchSemanticsNodes().isNotEmpty()
        }
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Fictional destination").assertDoesNotExist()
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
    }
}
