package org.trustroots.android.ui

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.tileprovider.MapTileProviderBasic
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.common.MemberNavigationBar
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.search.SearchHubScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

/** Native end-to-end journeys use a local HTTP API and real map/view lifecycles. */
@RunWith(AndroidJUnit4::class)
class DesignFixesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val api = MobileApiClient("http://127.0.0.1:${server.localPort}")
    private val session = MemberSession("connect.sid=design-test", MobileMember("steady-heron", "Steady Heron"))
    private val insets = PaddingValues(start = 24.dp, top = 32.dp, end = 40.dp, bottom = 96.dp)

    @After fun closeServer() = server.close()

    @Test fun hostProfileCanBeOpenedRepeatedlyAndMapIsReleasedWhenLeavingSearch() {
        serve { request ->
            when {
                request.contains("/api/offers?") -> """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
                request.contains("/api/offers/offer-one") -> """{"_id":"offer-one","status":"yes","description":"A fictional spare room","user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
                request.contains("/api/users/quiet-fox") -> """{"username":"quiet-fox","displayName":"Quiet Fox","description":"Fictional host profile"}"""
                else -> "[]"
            }
        }
        compose.setContent { frame(Destination.Search) { padding ->
            SearchHubScreen(api, session, {}, contentPadding = padding)
        } }
        lateinit var originalMap: MapView
        compose.waitUntil(15_000) { findMap()?.overlays?.any { it is Marker } == true }
        compose.runOnIdle { originalMap = requireNotNull(findMap()) }
        repeat(2) {
            compose.onRoot().performTouchInput { click(center) }
            compose.waitUntil(10_000) { compose.onAllNodesWithTag("hostResultCard").fetchSemanticsNodes().isNotEmpty() }
            val card = compose.onNodeWithTag("hostResultCard").fetchSemanticsNode().boundsInRoot
            val nav = compose.onNodeWithTag("navigation-search").fetchSemanticsNode().boundsInRoot
            assertTrue("Host result must sit above navigation", card.bottom <= nav.top)
            compose.onNodeWithTag("hostResultCard").performClick()
            compose.waitUntil(10_000) { compose.onAllNodesWithText("Fictional host profile").fetchSemanticsNodes().isNotEmpty() }
            compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
            compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
            compose.onNodeWithTag("hostResultCard").assertDoesNotExist()
            compose.onNodeWithText("A fictional spare room").assertDoesNotExist()
            compose.runOnIdle {
                assertSame(originalMap, findMap())
                assertNotNull((originalMap.tileProvider as MapTileProviderBasic).tileWriter)
            }
        }
        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithText("Find a member").assertIsDisplayed()
        compose.runOnIdle { assertNull((originalMap.tileProvider as MapTileProviderBasic).tileWriter) }
        compose.onNodeWithText("Switch to map search").performClick()
        compose.onNodeWithTag("placeSearchField").assertIsDisplayed()
        compose.runOnIdle { assertNotSame(originalMap, findMap()) }
    }

    @Test fun mapControlsAndResultsRespectAsymmetricInsets() {
        serve { request -> when {
            request.contains("/api/offers?") -> """{"features":[{"properties":{"id":"offer-one"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
            request.contains("/api/offers/offer-one") -> """{"_id":"offer-one","status":"yes","user":{"username":"quiet-fox","displayName":"Quiet Fox"}}"""
            request.contains("/api/users/quiet-fox") -> """{"username":"quiet-fox","displayName":"Quiet Fox"}"""
            else -> "[]"
        } }
        compose.setContent { frame(Destination.Search) { _ ->
            SearchHubScreen(api, session, {}, contentPadding = insets)
        } }
        val field = compose.onNodeWithTag("placeSearchField").fetchSemanticsNode().boundsInRoot
        val statistics = compose.onNodeWithTag("mapStatistics").fetchSemanticsNode().boundsInRoot
        val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertTrue(field.top >= 32.dp.toPx())
            assertTrue(field.left >= 24.dp.toPx())
            assertTrue(statistics.bottom <= root.bottom - 96.dp.toPx())
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithTag("mapStatistics").assertIsDisplayed()
        compose.waitUntil(15_000) { findMap()?.overlays?.any { it is Marker } == true }
        compose.onRoot().performTouchInput { click(center) }
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("hostResultCard").fetchSemanticsNodes().isNotEmpty() }
        val card = compose.onNodeWithTag("hostResultCard").fetchSemanticsNode().boundsInRoot
        val sheet = compose.onNodeWithTag("hostDetailSheet").fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertEquals(24.dp.toPx(), sheet.left, 1f)
            assertEquals(root.right - 40.dp.toPx(), sheet.right, 1f)
            assertEquals(sheet.left + 12.dp.toPx(), card.left, 1f)
            assertEquals(sheet.right - 12.dp.toPx(), card.right, 1f)
            assertTrue(card.bottom <= root.bottom - 96.dp.toPx())
        }
    }

    @Test fun hostFormActionsStayBelowStatusBarAndInsideSideInsets() {
        serve { request -> if (request.contains("/api/users/")) {
            """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron"}"""
        } else "[]" }
        var cancelled = false
        compose.setContent { TrustrootsTheme {
            HostOfferScreen(api, session, {}, onBack = { cancelled = true }, contentPadding = insets)
        } }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Hosting description").fetchSemanticsNodes().isNotEmpty() }
        val cancel = compose.onNodeWithContentDescription("Cancel").fetchSemanticsNode().boundsInRoot
        val save = compose.onNodeWithText("Save changes").fetchSemanticsNode().boundsInRoot
        val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertTrue(cancel.top >= 32.dp.toPx())
            assertTrue(cancel.left >= 24.dp.toPx())
            assertTrue(save.right <= root.right - 40.dp.toPx())
        }
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.runOnIdle { assertTrue(cancelled) }
    }

    @Test fun embeddedBrowserKeepsBackAndWebContentInsideVerticalInsets() {
        var closed = false
        lateinit var rootView: View
        compose.setContent { TrustrootsTheme {
            rootView = LocalView.current
            TrustrootsBrowser(BrowserRoute("Fictional help page", "about:blank"), { closed = true }, contentPadding = insets)
        } }
        val back = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
        compose.runOnIdle {
            val browser = requireNotNull(findView<WebView>(compose.activity.window.decorView))
            val browserLocation = IntArray(2).also { browser.getLocationInWindow(it) }
            val rootLocation = IntArray(2).also { rootView.getLocationInWindow(it) }
            val browserBottom = browserLocation[1] - rootLocation[1] + browser.height
            with(compose.density) {
                assertTrue(back.top >= 32.dp.toPx())
                assertTrue(browserBottom <= root.bottom - 96.dp.toPx() + 1f)
            }
        }
        compose.onNodeWithContentDescription("Back").performClick()
        compose.runOnIdle { assertTrue(closed) }
    }

    @Test fun lastConversationRemainsReachableAboveNavigationAndCanBeOpened() {
        val threads = (1..30).joinToString(",", "[", "]") { index ->
            """{"_id":"thread-$index","userFrom":{"_id":"member-$index","username":"traveller-$index","displayName":"Traveller $index"},"userTo":{"username":"steady-heron"},"message":{"excerpt":"Fictional message $index"},"read":false}"""
        }
        serve { request -> if (request.contains("/api/messages?")) threads else "[]" }
        compose.setContent { frame(Destination.Messages) { padding ->
            MessageInboxScreen(api, session, {}, contentPadding = padding)
        } }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Traveller 1").fetchSemanticsNodes().isNotEmpty() }
        compose.onNode(hasScrollToIndexAction()).performScrollToIndex(29)
        compose.onNodeWithText("Traveller 30").assertIsDisplayed()
        val last = compose.onNodeWithText("Fictional message 30").fetchSemanticsNode().boundsInRoot
        val navigation = compose.onNodeWithTag("navigation-messages").fetchSemanticsNode().boundsInRoot
        assertTrue(last.bottom <= navigation.top)
        compose.onNodeWithText("Traveller 30").performClick()
        compose.onNodeWithTag("messageComposer").assertIsDisplayed()
        compose.waitForIdle()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        compose.onNodeWithText("Traveller 30").assertIsDisplayed()
        compose.onNode(hasScrollToIndexAction()).performScrollToIndex(0)
        compose.waitForIdle()
        compose.waitUntil(5_000) {
            compose.onAllNodesWithText("Filter conversations").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("messageInboxFilter").performScrollTo().performTextInput("traveller-30")
        compose.onNodeWithText("Traveller 30").assertIsDisplayed()
        compose.onNodeWithText("Traveller 1").assertDoesNotExist()
    }

    @Test fun lastCircleAndItsDescriptionRemainReachableWithInsets() {
        val circles = (1..30).joinToString(",", "[", "]") { index ->
            """{"_id":"circle-$index","slug":"circle-$index","label":"Circle ${index.toString().padStart(2, '0')}","count":1,"description":"<p>Fictional circle <strong>$index</strong> description</p>"}"""
        }
        serve { request ->
            when {
                request.startsWith("GET /api/tribes/circle-30 ") -> """{"_id":"circle-30","slug":"circle-30","label":"Circle 30","count":1,"description":"<p>Fictional circle <strong>30</strong> description</p>"}"""
                request.startsWith("GET /api/tribes") -> circles
                else -> "[]"
            }
        }
        compose.setContent { frame(Destination.Circles) { padding ->
            CirclesScreen(api, session, {}, contentPadding = padding)
        } }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Circle 01").fetchSemanticsNodes().isNotEmpty() }
        compose.onNode(hasScrollToIndexAction()).performScrollToIndex(30)
        compose.onNodeWithText("Circle 30").assertIsDisplayed()
        val last = compose.onNodeWithText("Circle 30").fetchSemanticsNode().boundsInRoot
        val navigation = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot
        assertTrue(last.bottom <= navigation.top)
        compose.onNodeWithText("Circle 30").performClick()
        compose.onNodeWithText("Fictional circle 30 description").assertIsDisplayed()
        compose.onNodeWithText("Join circle").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").assertIsDisplayed().performClick()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
    }

    @Test fun horizontalInsetsPreservePhysicalEdgesInBothLayoutDirections() {
        var observed = PaddingValues.Zero
        val direction = androidx.compose.runtime.mutableStateOf(LayoutDirection.Ltr)
        compose.setContent {
            CompositionLocalProvider(LocalLayoutDirection provides direction.value) {
                observed = insets.horizontalInset()
            }
        }
        for (layout in LayoutDirection.entries) {
            compose.runOnIdle { direction.value = layout }
            compose.runOnIdle {
                assertEquals(insets.calculateLeftPadding(layout), observed.calculateLeftPadding(layout))
                assertEquals(insets.calculateRightPadding(layout), observed.calculateRightPadding(layout))
                assertEquals(0.dp, observed.calculateTopPadding())
                assertEquals(0.dp, observed.calculateBottomPadding())
            }
        }
    }

    @Composable private fun frame(destination: Destination, content: @Composable (PaddingValues) -> Unit) {
        TrustrootsTheme {
            Scaffold(contentWindowInsets = WindowInsets.safeDrawing, bottomBar = {
                MemberNavigationBar(destination, 0, null, null, "Steady Heron", {})
            }) { padding ->
                Box(Modifier.fillMaxSize()) { content(padding) }
            }
        }
    }

    private fun findMap(): MapView? = findView<MapView>(compose.activity.window.decorView)

    private inline fun <reified T : View> findView(root: View): T? {
        val pending = ArrayDeque<View>()
        pending.add(root)
        while (pending.isNotEmpty()) {
            val view = pending.removeFirst()
            if (view is T) return view
            if (view is ViewGroup) for (index in 0 until view.childCount) pending.add(view.getChildAt(index))
        }
        return null
    }

    private fun serve(payload: (String) -> String) {
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val connection = runCatching { server.accept() }.getOrNull() ?: break
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val bytes = payload(request).toByteArray()
                    runCatching {
                        socket.getOutputStream().write(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        socket.getOutputStream().write(bytes)
                    }
                }
            }
        }
    }
}
