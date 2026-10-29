package org.trustroots.android.ui

import android.location.Address
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostmap.HostMapScreen

@RunWith(AndroidJUnit4::class)
class HostMapLocationClusterJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val server = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<SearchBounds>()
    private val geocoderCalls = CopyOnWriteArrayList<Pair<String, Int>>()
    private val activeSocket = AtomicReference<Socket?>()
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder?.join(1_000)
    }

    private fun acceptOrStop(): Socket? = try {
        server.accept()
    } catch (error: SocketException) {
        if (server.isClosed) null else throw error
    }

    @Test fun selectsOfflinePlaceSuggestionZoomsAClusterAndReportsMissingPlaces() {
        responder = thread(isDaemon = true) {
            try {
                while (true) {
                    val socket = acceptOrStop() ?: return@thread
                    activeSocket.set(socket)
                    socket.soTimeout = 5_000
                    try {
                        socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    val headers = mutableListOf<String>()
                    while (true) {
                        val line = input.readLine() ?: break
                        if (line.isEmpty()) break
                        headers += line
                    }
                    val bodyLength = headers.firstOrNull { it.startsWith("Content-Length:", true) }
                        ?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0
                    repeat(bodyLength) {
                        if (input.read() == -1) throw IOException("Request body ended before Content-Length")
                    }
                    val bounds = SearchBounds.from(request)
                    if (bounds != null) requests += bounds
                    val payload = when {
                        bounds != null && bounds.contains(TARGET_LATITUDE, TARGET_LONGITUDE) -> featureCollection()
                        request.startsWith("GET /api/offers?") -> """{"features":[]}"""
                        else -> "[]"
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                        }
                    } catch (error: IOException) {
                        if (server.isClosed) return@thread
                        throw error
                    } finally {
                        activeSocket.compareAndSet(socket, null)
                    }
                }
            } catch (error: IOException) {
                if (!server.isClosed) throw error
            }
        }
        compose.setContent {
            HostMapScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                onSessionInvalidated = {},
                geocoderLookup = { _, query, maxResults ->
                    geocoderCalls += query to maxResults
                    if (query == "Fictional Harbour") {
                        listOf(
                            Address(Locale.US).apply {
                                latitude = 40.0
                                longitude = -8.0
                                setAddressLine(0, "Fictional Harbour East")
                            },
                            Address(Locale.US).apply {
                                latitude = TARGET_LATITUDE
                                longitude = TARGET_LONGITUDE
                                setAddressLine(0, "Fictional Harbour, Somewhere")
                            },
                        )
                    } else if (query == "Unmapped Place") {
                        emptyList()
                    } else {
                        null
                    }
                },
            )
        }

        compose.waitUntil(15_000) { requests.isNotEmpty() }
        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Fictional Harbour, Somewhere").fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue(geocoderCalls.any { it == ("Fictional Harbour" to 3) })
        compose.onNodeWithText("Fictional Harbour East").assertIsDisplayed()
        compose.onNodeWithText("Fictional Harbour, Somewhere").performClick()
        compose.waitUntil(15_000) {
            requests.any { it.contains(TARGET_LATITUDE, TARGET_LONGITUDE) } &&
                compose.onAllNodesWithText("3 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        val zoomBeforeCluster = requests.last { it.contains(TARGET_LATITUDE, TARGET_LONGITUDE) }
        val requestCountBeforeCluster = requests.size
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        compose.waitUntil(15_000) {
            requests.size > requestCountBeforeCluster &&
                requests.drop(requestCountBeforeCluster).any {
                    it.contains(TARGET_LATITUDE, TARGET_LONGITUDE) &&
                        it.longitudeSpan < zoomBeforeCluster.longitudeSpan * 0.75
                }
        }
        assertTrue(requests.drop(requestCountBeforeCluster).any {
            it.contains(TARGET_LATITUDE, TARGET_LONGITUDE) &&
                it.longitudeSpan < zoomBeforeCluster.longitudeSpan * 0.75
        })

        compose.onNodeWithTag("placeSearchField").performTextReplacement("Fictional Harbour")
        compose.onNodeWithTag("submittedSearchButton").performClick()
        compose.waitUntil(10_000) { geocoderCalls.any { it == ("Fictional Harbour" to 1) } }
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()

        compose.onNodeWithTag("placeSearchField").performTextReplacement("Unmapped Place")
        compose.onNodeWithTag("submittedSearchButton").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Could not find that place.").fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue(geocoderCalls.any { it == ("Unmapped Place" to 1) })
        compose.onNodeWithText("Could not find that place.").assertIsDisplayed()

        // Android's geocoder may return null as well as an empty list for no matches.
        compose.onNodeWithTag("placeSearchField").performTextReplacement("No Address Match")
        compose.onNodeWithTag("submittedSearchButton").performClick()
        compose.waitUntil(10_000) {
            geocoderCalls.any { it == ("No Address Match" to 1) } &&
                compose.onAllNodesWithText("Could not find that place.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Could not find that place.").assertIsDisplayed()
    }

    private fun featureCollection(): String = """{"features":[
        {"properties":{"id":"offer-one","type":"host","status":"yes"},"geometry":{"coordinates":[$TARGET_LONGITUDE,$TARGET_LATITUDE]}},
        {"properties":{"id":"offer-two","type":"host","status":"yes"},"geometry":{"coordinates":[$TARGET_LONGITUDE,$TARGET_LATITUDE]}},
        {"properties":{"id":"offer-three","type":"host","status":"yes"},"geometry":{"coordinates":[$TARGET_LONGITUDE,$TARGET_LATITUDE]}}
    ]}"""

    private data class SearchBounds(
        val south: Double,
        val west: Double,
        val north: Double,
        val east: Double,
    ) {
        val longitudeSpan get() = east - west
        fun contains(latitude: Double, longitude: Double) =
            south < latitude && north > latitude && west < longitude && east > longitude

        companion object {
            fun from(request: String): SearchBounds? {
                if (!request.startsWith("GET /api/offers?")) return null
                fun value(name: String) = Regex("(?:[?&])$name=([^& ]+)").find(request)?.groupValues?.get(1)?.toDoubleOrNull()
                val south = value("southWestLat") ?: return null
                val west = value("southWestLng") ?: return null
                val north = value("northEastLat") ?: return null
                val east = value("northEastLng") ?: return null
                return SearchBounds(south, west, north, east)
            }
        }
    }

    private companion object {
        const val TARGET_LATITUDE = 40.7128
        const val TARGET_LONGITUDE = -74.0060
    }
}
