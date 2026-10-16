package org.trustroots.android.ui

import android.content.Context
import android.graphics.Point
import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember

@RunWith(AndroidJUnit4::class)
class HostMapOfferClusterThresholdJourneyTest {
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

    @Test fun clusteredOffersBecomeIndividualMarkersAtHighZoom() {
        val mapReference = AtomicReference<MapView?>()
        val offersPayload = AtomicReference(EMPTY_OFFERS)
        val offerSearches = AtomicInteger()
        val offerSearchResponses = AtomicInteger()
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path.startsWith("/api/offers?") -> {
                    offerSearches.incrementAndGet()
                    offerSearchResponses.incrementAndGet()
                    LocalTransportFixture.Response(offersPayload.get())
                }
                request.method == "GET" && request.path == "/api/offers/offer-two" ->
                    LocalTransportFixture.Response(SECOND_OFFER)
                request.method == "GET" && request.path == "/api/users/quiet-fox" ->
                    LocalTransportFixture.Response(
                        """{"_id":"member-two","username":"quiet-fox","displayName":"Quiet Fox"}""",
                    )
                request.method == "GET" && request.path == "/api/users/memberships" ->
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
                session = MemberSession(
                    SESSION_COOKIE,
                    MobileMember("steady-heron", "Steady Heron"),
                ),
                onSessionInvalidated = {},
                geocoderLookup = { _, _, _ -> emptyList() },
                mapViewFactory = offlineMapViewFactory,
            )
        }

        compose.waitUntil(15_000) {
            offerSearches.get() > 0 &&
                mapReference.get()?.let { it.width > 0 && it.height > 0 } == true
        }

        val offerLocations = AtomicReference<List<GeoPoint>>(emptyList())
        val clusterTouch = AtomicReference(Offset.Zero)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            map.controller.setCenter(GeoPoint(CENTRE_LATITUDE, CENTRE_LONGITUDE))
            map.controller.setZoom(LOW_CLUSTER_ZOOM)
            val cellWidth = (CLUSTER_CELL_DP * map.resources.displayMetrics.density).toInt().coerceAtLeast(1)
            val cellCentreX = (map.width / 2 / cellWidth) * cellWidth + cellWidth / 2
            val y = (map.height * TOUCH_Y_FRACTION).toInt()
            val spacing = (cellWidth * LOW_ZOOM_SPACING_FRACTION).toInt()
            offerLocations.set(
                listOf(-spacing, 0, spacing).map { offset ->
                    map.projection.fromPixels(cellCentreX + offset, y).let { GeoPoint(it.latitude, it.longitude) }
                },
            )
            clusterTouch.set(Offset(cellCentreX.toFloat(), y.toFloat()))
            offersPayload.set(featureCollection(offerLocations.get()))
        }

        compose.waitUntil(15_000) {
            offerSearchResponses.get() > 1 &&
                compose.onAllNodesWithText("3 offers · 0 Nostroots notes in this area")
                    .fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue(currentZoom(mapReference) < CLUSTER_ZOOM_THRESHOLD)
        val clusteredSearchCount = offerSearches.get()
        val clusteredBounds = latestOfferSearchBounds(local)
        assertTrue("All three fixture offers should be near the fictional map centre", clusteredBounds.contains(CENTRE_LATITUDE, CENTRE_LONGITUDE))

        compose.onNodeWithTag("hostMapView").performTouchInput { click(clusterTouch.get()) }
        compose.waitUntil(15_000) {
            currentZoom(mapReference) >= CLUSTER_ZOOM_THRESHOLD + 1 &&
                offerSearches.get() > clusteredSearchCount &&
                offerSearchResponses.get() > clusteredSearchCount &&
                latestOfferSearchBounds(local).longitudeSpan < clusteredBounds.longitudeSpan * SEARCH_SPAN_RATIO
        }
        val highZoom = currentZoom(mapReference)
        assertTrue("Tapping the low-zoom cluster should zoom in", highZoom >= CLUSTER_ZOOM_THRESHOLD + 1)
        assertTrue(
            "The zoomed map should request a smaller visible area",
            latestOfferSearchBounds(local).longitudeSpan < clusteredBounds.longitudeSpan * SEARCH_SPAN_RATIO,
        )

        compose.waitForIdle()
        val middleOfferLocation = offerLocations.get()[1]
        val middleMarkerTouch = AtomicReference(Offset.Zero)
        compose.runOnUiThread {
            val map = requireNotNull(mapReference.get())
            val point = map.projection.toPixels(middleOfferLocation, Point())
            middleMarkerTouch.set(Offset(point.x.toFloat(), point.y.toFloat()))
        }
        val highZoomSearchCount = offerSearches.get()
        compose.onNodeWithTag("hostMapView").performTouchInput { click(middleMarkerTouch.get()) }
        compose.waitUntil(10_000) {
            local.requests.any { it.path == "/api/offers/offer-two" } &&
                compose.onAllNodesWithText(SECOND_OFFER_DESCRIPTION).fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText(SECOND_OFFER_DESCRIPTION).assertIsDisplayed()
        assertEquals("Opening the individual marker should not zoom the map again", highZoom, currentZoom(mapReference), 0.1)
        assertEquals("Opening one offer should not start another area search", highZoomSearchCount, offerSearches.get())
        assertTrue(
            local.requests.any {
                it.method == "GET" && it.path == "/api/offers/offer-two" && it.cookie == SESSION_COOKIE
            },
        )
        assertTrue(local.requests.filter { it.path.startsWith("/api/offers?") }.all {
            it.method == "GET" && it.cookie == SESSION_COOKIE
        })
    }

    private fun currentZoom(mapReference: AtomicReference<MapView?>): Double {
        var zoom = 0.0
        compose.runOnUiThread { zoom = requireNotNull(mapReference.get()).zoomLevelDouble }
        return zoom
    }

    private fun latestOfferSearchBounds(local: LocalTransportFixture): SearchBounds =
        local.requests.last { it.method == "GET" && it.path.startsWith("/api/offers?") }
            .let { SearchBounds.from(it.path) }

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
            fun from(path: String): SearchBounds {
                fun value(name: String): Double =
                    Regex("(?:[?&])$name=([^&]+)").find(path)?.groupValues?.get(1)?.toDouble()
                        ?: error("Missing $name in offer search path: $path")

                return SearchBounds(
                    south = value("southWestLat"),
                    west = value("southWestLng"),
                    north = value("northEastLat"),
                    east = value("northEastLng"),
                )
            }
        }
    }

    private companion object {
        const val SESSION_COOKIE = "connect.sid=fictional-offer-cluster-session"
        const val CENTRE_LATITUDE = 30.25
        const val CENTRE_LONGITUDE = 12.5
        const val LOW_CLUSTER_ZOOM = 13.0
        const val CLUSTER_ZOOM_THRESHOLD = 14.0
        const val CLUSTER_CELL_DP = 50
        const val LOW_ZOOM_SPACING_FRACTION = 0.30
        const val TOUCH_Y_FRACTION = 0.62
        const val SEARCH_SPAN_RATIO = 0.75
        const val SECOND_OFFER_DESCRIPTION = "A fictional second room."
        const val EMPTY_OFFERS = """{"features":[]}"""
        const val SECOND_OFFER =
            """{"_id":"offer-two","status":"yes","description":"$SECOND_OFFER_DESCRIPTION","maxGuests":1,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""

        fun featureCollection(locations: List<GeoPoint>): String =
            locations.mapIndexed { index, point ->
                """{"properties":{"id":"offer-${listOf("one", "two", "three")[index]}","type":"host","status":"yes"},"geometry":{"coordinates":[${point.longitude},${point.latitude}]}}"""
            }.joinToString(",", """{"features":[""", "]}")
    }
}
