package org.trustroots.android.ui

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.ui.theme.TrustrootsTheme

/** Native end-to-end journeys use a local HTTP API and real map/view lifecycles. */
@RunWith(AndroidJUnit4::class)
class DesignFixesJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private val api = MobileApiClient("http://127.0.0.1:${server.localPort}")
    private val session = MemberSession("connect.sid=design-test", MobileMember("steady-heron", "Steady Heron"))
    private val insets = PaddingValues(top = 32.dp, bottom = 96.dp)

    @After fun closeServer() = server.close()

    @Test fun returnsFromHostProfileToWorkingMapRepeatedly() {
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
            compose.runOnIdle {
                assertSame(originalMap, findMap())
            }
            compose.onNodeWithContentDescription("Close host result").performClick()
        }
    }

    @Test fun mapControlsAndStatisticsRespectVerticalInsets() {
        serve { """{"features":[]}""" }
        compose.setContent { TrustrootsTheme { HostMapScreen(api, session, {}, contentPadding = insets) } }
        val field = compose.onNodeWithTag("placeSearchField").fetchSemanticsNode().boundsInRoot
        val statistics = compose.onNodeWithTag("mapStatistics").fetchSemanticsNode().boundsInRoot
        val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertTrue(field.top >= 32.dp.toPx())
            assertTrue(statistics.bottom <= root.bottom - 96.dp.toPx())
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Hosting").assertIsDisplayed()
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithTag("mapStatistics").assertIsDisplayed()
    }

    @Test fun hostFormActionsStayBelowStatusBar() {
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
        with(compose.density) {
            assertTrue(cancel.top >= 32.dp.toPx())
            assertTrue(save.top >= 32.dp.toPx())
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
