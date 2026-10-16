package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.URLDecoder
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
class HostMapRetryJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<String>()
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

    private fun isOneMonthOffersRequest(request: String): Boolean {
        if (!request.startsWith("GET /api/offers?")) return false
        val encodedFilters = request.substringAfter("filters=", "").substringBefore(' ')
        return URLDecoder.decode(encodedFilters, Charsets.UTF_8.name()).contains("\"months\":1")
    }

    @Test fun displaysSearchFailureAndRetriesWhenFiltersChange() {
        responder = thread(isDaemon = true) {
            var retrySucceeded = false
            while (!retrySucceeded) {
                val socket = acceptOrStop() ?: break
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    requests += request
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val isCircleList = request.startsWith("GET /api/tribes?")
                    val isFilteredRetry = isOneMonthOffersRequest(request)
                    val status = when {
                        isCircleList || isFilteredRetry -> "200 OK"
                        else -> "500 Internal Server Error"
                    }
                    val payload = when {
                        isCircleList -> "[]"
                        isFilteredRetry -> """{"features":[]}"""
                        else -> """{"message":"Local search unavailable."}"""
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                    retrySucceeded = isFilteredRetry
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

        compose.waitUntil(15_000) { requests.isNotEmpty() && compose.onAllNodesWithText("Local search unavailable.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Local search unavailable.").assertIsDisplayed()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").performClick()
        compose.waitUntil(15_000) {
            requests.any(::isOneMonthOffersRequest) &&
                compose.onAllNodesWithText("0 offers · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("0 offers · 0 Nostroots notes in this area").assertIsDisplayed()
        check(requests.any(::isOneMonthOffersRequest))
        responder?.join(1_000)
    }
}
