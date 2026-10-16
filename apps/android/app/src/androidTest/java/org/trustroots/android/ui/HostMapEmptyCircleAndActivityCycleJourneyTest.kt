package org.trustroots.android.ui

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.activity.ComponentActivity
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URLDecoder
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostMapEmptyCircleAndActivityCycleJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val requests = CopyOnWriteArrayList<String>()
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private val offlineMapViewFactory: (Context) -> MapView = { context ->
        MapView(context).apply { setUseDataConnection(false) }
    }
    private var responder: Thread? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            runCatching { server.close() }
            responder?.join(2_000)
            assertTrue("The local map fixture should stop after shutdown", responder?.isAlive != true)
        } finally {
            responderFailure.get()?.let { throw AssertionError("The local map fixture failed", it) }
        }
    }

    @Test fun retriesLoadingCirclesWhenTheFilterListIsEmpty() {
        startFixture()
        showMap()
        waitForInitialOffers()

        compose.onNodeWithTag("openFilters").performClick()
        waitForRequestCount("GET /api/tribes?", 1)
        compose.onNodeWithText("All circles").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Wanderers").fetchSemanticsNodes().isEmpty())

        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithTag("openFilters").performClick()
        waitForRequestCount("GET /api/tribes?", 2)
        compose.onNodeWithText("All circles").assertIsDisplayed()
    }

    @Test fun cyclesActivityFilterFromAnyTimeThroughOneAndSixMonthsBackToAnyTime() {
        startFixture()
        showMap()
        waitForInitialOffers()
        compose.onNodeWithTag("openFilters").performClick()

        // The screen starts at six months. This first transition establishes the null/any-time
        // state before exercising the full null -> 1 -> 6 -> null cycle.
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        waitForOfferFilter(months = null, after = 0)

        var count = requests.count { isOfferFilter(it, months = 1) }
        compose.onNodeWithText("Last active: any time").performClick()
        compose.onNodeWithText("Last active: 1 month").assertIsDisplayed()
        waitForOfferFilter(months = 1, after = count)

        count = requests.count { isOfferFilter(it, months = 6) }
        compose.onNodeWithText("Last active: 1 month").performClick()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
        waitForOfferFilter(months = 6, after = count)

        count = requests.count { isOfferFilter(it, months = null) }
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        waitForOfferFilter(months = null, after = count)
    }

    private fun showMap() {
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=fictional-filter-session", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, _, _ -> emptyList() },
                mapViewFactory = offlineMapViewFactory,
            )
        }
    }

    private fun startFixture() {
        responder = thread(isDaemon = true, name = "host-map-empty-circles-local-api") {
            try {
                while (!server.isClosed) {
                    val socket = try {
                        server.accept()
                    } catch (_: SocketTimeoutException) {
                        continue
                    } catch (error: SocketException) {
                        if (server.isClosed) break else throw error
                    }
                    activeSocket.set(socket)
                    try {
                        socket.soTimeout = 5_000
                        socket.use { connection ->
                            val input = connection.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                            val request = input.readLine().orEmpty()
                            var contentLength = 0
                            while (true) {
                                val header = input.readLine() ?: throw IOException("EOF before request headers completed")
                                if (header.isEmpty()) break
                                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                    contentLength = header.substringAfter(':').trim().toIntOrNull()
                                        ?: throw IOException("Invalid Content-Length header")
                                }
                            }
                            repeat(contentLength) {
                                if (input.read() < 0) throw IOException("Request body ended before Content-Length bytes were read")
                            }
                            requests += request
                            val body = when {
                                request.startsWith("GET /api/tribes?") -> "[]"
                                request.startsWith("GET /api/offers?") -> """{"features":[]}"""
                                else -> "{}"
                            }
                            val bytes = body.toByteArray(Charsets.UTF_8)
                            connection.getOutputStream().apply {
                                write(
                                    "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                        .toByteArray(Charsets.US_ASCII),
                                )
                                write(bytes)
                                flush()
                            }
                        }
                    } catch (error: SocketException) {
                        if (!server.isClosed) responderFailure.compareAndSet(null, error)
                    } catch (error: IOException) {
                        if (!server.isClosed) responderFailure.compareAndSet(null, error)
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                    }
                }
            } catch (error: Throwable) {
                if (!server.isClosed) responderFailure.compareAndSet(null, error)
            }
        }
    }

    private fun waitForInitialOffers() {
        compose.waitUntil(15_000) {
            requests.any { it.startsWith("GET /api/offers?") } &&
                compose.onAllNodesWithText("0 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForRequestCount(prefix: String, count: Int) {
        compose.waitUntil(10_000) { requests.count { it.startsWith(prefix) } >= count }
    }

    private fun waitForOfferFilter(months: Int?, after: Int) {
        compose.waitUntil(15_000) {
            requests.count { isOfferFilter(it, months) } > after
        }
    }

    private fun isOfferFilter(request: String, months: Int?): Boolean {
        if (!request.startsWith("GET /api/offers?")) return false
        val filters = URLDecoder.decode(
            request.substringAfter("filters=", "").substringBefore(' '),
            Charsets.UTF_8.name(),
        )
        return if (months == null) !filters.contains("\"months\"")
        else filters.contains("\"months\":$months")
    }
}
