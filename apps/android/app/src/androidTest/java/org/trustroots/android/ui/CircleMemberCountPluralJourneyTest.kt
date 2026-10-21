package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.circles.CirclesScreen

@RunWith(AndroidJUnit4::class)
class CircleMemberCountPluralJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)
    private var responder: Thread? = null

    @After fun closeServer() {
        server.close()
        responder?.join(1_000)
    }

    @Test fun overviewAndDetailCountsUseSingularOnlyForOneAndFitLongRtlCounts() {
        val circles = listOf(
            circle("zero-circle", "Zero Circle", 0),
            circle("single-circle", "Single Circle", 1),
            circle("pair-circle", "Pair Circle", 2),
            circle("long-circle", "A Long Fictional Circle Name", 123456789),
        )
        responder = thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                }
                socket.use {
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    while (!input.readLine().isNullOrEmpty()) Unit
                    val path = request.substringAfter(' ').substringBefore(' ')
                    val circle = circles.firstOrNull { path == "/api/tribes/${it.slug}" }
                    val body = when {
                        circle != null -> circle.json()
                        path.startsWith("/api/tribes?") -> circles.joinToString(",", "[", "]") { it.json() }
                        path == "/api/users/memberships" -> "[]"
                        path.startsWith("/api/users/memberships/") -> "{}"
                        else -> "{}"
                    }
                    val bytes = body.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }

        compose.setContent {
            NativeTestAppFrame(Destination.Circles) {
                androidx.compose.runtime.CompositionLocalProvider(
                    LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Rtl,
                ) {
                    CirclesScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = MemberSession("connect.sid=test", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                    )
                }
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("123456789 members").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("0 members").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("1 member").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("2 members").performScrollTo().assertIsDisplayed()
        val longCountBounds = compose.onNodeWithText("123456789 members").performScrollTo()
            .fetchSemanticsNode().boundsInRoot
        val screenBounds = compose.onRoot().fetchSemanticsNode().boundsInRoot
        assertTrue("Long RTL count must stay within the screen", longCountBounds.left >= screenBounds.left)
        assertTrue("Long RTL count must stay within the screen", longCountBounds.right <= screenBounds.right)

        compose.onNodeWithText("A Long Fictional Circle Name").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("123456789 members").fetchSemanticsNodes().isNotEmpty() &&
                compose.onAllNodesWithText("Join circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("123456789 members").assertIsDisplayed()
    }

    private data class FixtureCircle(val slug: String, val label: String, val count: Int) {
        fun json() = """{"_id":"circle-$slug","slug":"$slug","label":"$label","count":$count,"image":false}"""
    }

    private fun circle(slug: String, label: String, count: Int) = FixtureCircle(slug, label, count)
}
