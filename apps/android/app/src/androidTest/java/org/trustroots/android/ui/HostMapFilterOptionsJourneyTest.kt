package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.URLDecoder
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapScreen

@RunWith(AndroidJUnit4::class)
class HostMapFilterOptionsJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val offerFilters = CopyOnWriteArrayList<String>()
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

    @Test fun clearsResultsWhenNoOfferTypeIsSelectedAndAppliesLanguageFilter() {
        responder = thread(isDaemon = true) {
            while (true) {
                val socket = acceptOrStop() ?: return@thread
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    val headers = mutableListOf<String>()
                    while (true) {
                        val line = input.readLine() ?: break
                        if (line.isEmpty()) break
                        headers += line
                    }
                    val contentLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                        ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                    repeat(contentLength) { input.read() }
                    val payload = when {
                        request.startsWith("GET /api/tribes") -> "[]"
                        request.startsWith("GET /api/offers?") -> {
                            val encoded = request.substringAfter("filters=", "").substringBefore(' ')
                            val filters = URLDecoder.decode(encoded, Charsets.UTF_8.name())
                            offerFilters += filters
                            if (!filters.contains("\"languages\"")) {
                                """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
                            } else {
                                """{"features":[]}"""
                            }
                        }
                        else -> "{}"
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }

        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
            )
        }

        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").performClick()
        compose.onNodeWithText("0 offers · 0 Nostroots notes in this area").assertIsDisplayed()

        val hostRequestsBeforeReenable = offerFilters.count { it.contains("\"types\":[\"host\"]") }
        compose.onNodeWithText("Hosting").performClick()
        compose.waitUntil(15_000) {
            offerFilters.count { it.contains("\"types\":[\"host\"]") } > hostRequestsBeforeReenable
        }
        compose.onNodeWithText("Spoken languages").performScrollTo().performClick()
        val languageRequestsBeforeSelection = offerFilters.count { it.contains("\"languages\":[\"por\"]") }
        compose.onNodeWithText("Portuguese").performClick()
        compose.waitUntil(15_000) {
            offerFilters.count {
                it.contains("\"types\":[\"host\"]") && it.contains("\"languages\":[\"por\"]")
            } > languageRequestsBeforeSelection
        }
        assertTrue(offerFilters.any { it.contains("\"languages\":[\"por\"]") })

        val unfilteredRequestsBeforeClear = offerFilters.count { !it.contains("\"languages\"") }
        compose.onNodeWithText("✓ Portuguese").performClick()
        compose.waitUntil(15_000) {
            offerFilters.count { it.contains("\"types\":[\"host\"]") && !it.contains("\"languages\"") } >
                unfilteredRequestsBeforeClear
        }
        assertTrue(offerFilters.any { !it.contains("\"languages\"") })
    }
}
