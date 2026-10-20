package org.trustroots.android.ui

import android.content.Context
import android.graphics.Point
import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.URLDecoder
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.ui.hostmap.HostMapScreen

@RunWith(AndroidJUnit4::class)
class HostMapMeetOfferJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        try {
            runCatching { compose.waitForIdle() }
        } finally {
            fixture?.close()
            fixture = null
        }
    }

    @Test fun enablingMeetFilterOpensMeetOfferFromItsMapMarker() {
        val session = MemberSession(
            "connect.sid=fictional-meet-session",
            MobileMember("steady-heron", "Steady Heron"),
        )
        val invalidations = AtomicInteger()
        val mapReference = AtomicReference<MapView?>()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") -> {
                    if ("meet" in requestedTypes(request.path)) {
                        LocalTransportFixture.Response(MEET_SEARCH)
                    } else {
                        LocalTransportFixture.Response("{\"features\":[]}")
                    }
                }
                request.method == "GET" && request.path == "/api/offers/meet-offer-one" ->
                    LocalTransportFixture.Response(MEET_OFFER)
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
                    )
                request.method == "GET" && request.path == "/api/users/memberships" ->
                    LocalTransportFixture.Response("[]")
                request.method == "GET" && request.path == "/api/tribes?limit=150" ->
                    LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = local
        val offlineMapViewFactory: (Context) -> MapView = { context ->
            MapView(context).apply {
                setUseDataConnection(false)
                mapReference.set(this)
            }
        }

        compose.setContent {
            HostMapScreen(
                api = MobileApiClient(local.baseURL),
                session = session,
                onSessionInvalidated = { invalidations.incrementAndGet() },
                geocoderLookup = { _, _, _ -> emptyList() },
                notesClientFactory = { onNote, onError ->
                    NostrootsNotesClient(onNote, onError, InertSocketFactory, "ws://127.0.0.1:1/relay")
                },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        val mapReady = AtomicReference(false)
        compose.waitUntil(15_000) {
            compose.runOnUiThread {
                mapReady.set(mapReference.get()?.let { it.width > 0 && it.height > 0 } == true)
            }
            local.requests.any { it.method == "GET" && it.path.startsWith("/api/offers?") } && mapReady.get()
        }
        assertTrue(
            "The initial host-only search must not receive a meet offer",
            local.requests.filter { it.method == "GET" && it.path.startsWith("/api/offers?") }
                .any { requestedTypes(it.path) == setOf("host") },
        )

        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Meet").performClick()

        val markerReady = AtomicReference(false)
        compose.waitUntil(15_000) {
            val meetSearchReceived = local.requests.any { request ->
                request.method == "GET" && request.path.startsWith("/api/offers?") &&
                    requestedTypes(request.path) == setOf("host", "meet")
            }
            compose.runOnUiThread {
                markerReady.set(
                    mapReference.get()?.overlays?.filterIsInstance<Marker>()
                        ?.any { it.title == "Potential host" } == true,
                )
            }
            meetSearchReceived && markerReady.get()
        }

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Meet").assertDoesNotExist()

        val markerOffset = AtomicReference(Offset.Zero)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val marker = map.overlays.filterIsInstance<Marker>().single { it.title == "Potential host" }
            val point = map.projection.toPixels(marker.position, Point())
            markerOffset.set(Offset(point.x.toFloat(), point.y.toFloat()))
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(markerOffset.get()) }

        compose.waitUntil(15_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/offers/meet-offer-one" } &&
                compose.onAllNodesWithText("Available to meet").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Available to meet").assertIsDisplayed()
        assertTrue(local.requests.any {
            it.method == "GET" && it.path == "/api/offers/meet-offer-one" && it.cookie == session.cookieHeader
        })
        assertTrue(local.requests.filter { it.path.startsWith("/api/offers?") }.all {
            it.method == "GET" && it.cookie == session.cookieHeader
        })
        assertEquals(0, invalidations.get())
    }

    private fun decodedFilters(path: String): String = URLDecoder.decode(
        path.substringAfter("filters=", "").substringBefore('&'),
        Charsets.UTF_8.name(),
    )

    private fun requestedTypes(path: String): Set<String> {
        val types = JSONObject(decodedFilters(path)).getJSONArray("types")
        return (0 until types.length()).map(types::getString).toSet()
    }

    private object InertSocketFactory : WebSocket.Factory {
        override fun newWebSocket(request: Request, listener: WebSocketListener): WebSocket = object : WebSocket {
            override fun request() = request
            override fun queueSize() = 0L
            override fun send(text: String) = true
            override fun send(bytes: ByteString) = true
            override fun close(code: Int, reason: String?) = true
            override fun cancel() = Unit
        }
    }

    private companion object {
        const val MEET_SEARCH = """{"features":[{"properties":{"id":"meet-offer-one","type":"meet","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
        const val MEET_OFFER = """{"_id":"meet-offer-one","status":"yes","user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
    }
}
