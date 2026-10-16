package org.trustroots.android.ui

import android.location.Address
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URLDecoder
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostMapDetailAndCircleFilterJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val requests = CopyOnWriteArrayList<String>()
    private val offerFilters = CopyOnWriteArrayList<String>()
    private val activeSocket = AtomicReference<Socket?>()
    private val responderFailure = AtomicReference<Throwable?>()
    private var responder: Thread? = null
    private val session = MemberSession("connect.sid=fictional-map-session", MobileMember("steady-heron", "Steady Heron"))

    @After fun closeFixture() {
        try {
            runCatching { server.close() }
            activeSocket.getAndSet(null)?.let { runCatching { it.close() } }
            responder?.join(1_000)
            assertFalse("The local map fixture should stop after server shutdown", responder?.isAlive == true)
        } finally {
            responderFailure.get()?.let { throw AssertionError("The local map fixture failed", it) }
        }
    }

    @Test fun showsServiceFailureAfterOpeningAHostMarker() {
        startFixture(detailStatus = 503)
        showMap()

        waitForInitialOffers()
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        waitForText("Fictional host details are temporarily unavailable.")

        compose.onNodeWithText("Fictional host details are temporarily unavailable.").assertIsDisplayed()
        assertEquals(0, invalidations.get())
        assertTrue(requests.any { it.startsWith("GET /api/offers/offer-one ") })
        assertTrue(requests.none { it.startsWith("GET /api/users/quiet-fox ") })
    }

    @Test fun invalidatesSessionAfterAnUnauthorisedHostMarkerRequest() {
        startFixture(detailStatus = 401)
        showMap()

        waitForInitialOffers()
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(10_000) {
            invalidations.get() == 1 && requests.any { it.startsWith("GET /api/offers/offer-one ") }
        }

        assertEquals(1, invalidations.get())
        compose.onNodeWithText("Fictional session expired.").assertDoesNotExist()
        assertTrue(requests.none { it.startsWith("GET /api/users/quiet-fox ") })
    }

    @Test fun deselectingOneCircleRemovesOnlyThatCircleFromTheOfferFilter() {
        startFixture()
        showMap()

        compose.waitUntil(15_000) { offerFilters.isNotEmpty() }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("All circles").performClick()
        waitForText("Quiet Circle")
        compose.onNodeWithText("Quiet Circle").performClick()
        compose.onNodeWithText("Wanderers").performClick()
        compose.waitUntil(15_000) {
            offerFilters.any { it.contains("\"tribes\":[\"circle-one\",\"circle-two\"]") }
        }
        val filterCountBeforeDeselect = offerFilters.size
        compose.onNodeWithText("✓ Quiet Circle").performClick()

        compose.waitUntil(15_000) {
            offerFilters.drop(filterCountBeforeDeselect)
                .any { it.contains("\"tribes\":[\"circle-one\"]") }
        }
        compose.onNodeWithText("Wanderers").assertIsDisplayed()
        compose.onNodeWithText("✓ Wanderers").assertIsDisplayed()
        val filtersAfterDeselect = offerFilters.drop(filterCountBeforeDeselect)
        assertTrue(filtersAfterDeselect.any { it.contains("\"tribes\":[\"circle-one\"]") })
        assertFalse(filtersAfterDeselect.any { it.contains("\"tribes\":[\"circle-one\",\"circle-two\"]") })
    }

    private val invalidations = AtomicInteger()

    private fun showMap() {
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = session,
                onSessionInvalidated = { invalidations.incrementAndGet() },
                geocoderLookup = { _, _ -> emptyList<Address>() },
            )
        }
    }

    private fun waitForInitialOffers() {
        compose.waitUntil(15_000) {
            requests.any { it.startsWith("GET /api/offers?") } &&
                compose.onAllNodesWithText("1 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun startFixture(detailStatus: Int? = null) {
        responder = thread(isDaemon = true, name = "host-map-detail-local-api") {
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
                            val input = connection.getInputStream().bufferedReader()
                            val request = input.readLine().orEmpty()
                            val headers = mutableListOf<String>()
                            while (true) {
                                val header = input.readLine() ?: throw IOException("EOF before request headers completed")
                                if (header.isEmpty()) break
                                headers += header
                            }
                            val contentLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                                ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                            repeat(contentLength) {
                                if (input.read() < 0) throw IOException("Request ended before Content-Length bytes were read")
                            }
                            requests += request
                            val response = fixtureResponse(request, detailStatus)
                            if (request.startsWith("GET /api/offers?")) {
                                offerFilters += URLDecoder.decode(
                                    request.substringAfter("filters=", "").substringBefore(' '),
                                    Charsets.UTF_8.name(),
                                )
                            }
                            val bytes = response.body.toByteArray(Charsets.UTF_8)
                            connection.getOutputStream().apply {
                                write(
                                    "HTTP/1.1 ${response.status} ${response.reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
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

    private fun fixtureResponse(request: String, detailStatus: Int?): FixtureResponse = when {
        request.startsWith("GET /api/offers?") -> FixtureResponse(
            200,
            "OK",
            """{"features":[{"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}""",
        )
        request.startsWith("GET /api/offers/offer-one ") && detailStatus == 503 -> FixtureResponse(
            503,
            "Service Unavailable",
            """{"message":"Fictional host details are temporarily unavailable."}""",
        )
        request.startsWith("GET /api/offers/offer-one ") && detailStatus == 401 -> FixtureResponse(
            401,
            "Unauthorized",
            """{"message":"Fictional session expired."}""",
        )
        request.startsWith("GET /api/offers/offer-one ") -> FixtureResponse(
            200,
            "OK",
            """{"_id":"offer-one","status":"yes","description":"A fictional room.","user":{"username":"quiet-fox","displayName":"Quiet Fox"}}""",
        )
        request.startsWith("GET /api/tribes?") -> FixtureResponse(
            200,
            "OK",
            """[{"_id":"circle-one","slug":"wanderers","label":"Wanderers","count":2},{"_id":"circle-two","slug":"quiet","label":"Quiet Circle","count":3}]""",
        )
        else -> FixtureResponse(404, "Not Found", "{}")
    }

    private data class FixtureResponse(val status: Int, val reason: String, val body: String)
}
