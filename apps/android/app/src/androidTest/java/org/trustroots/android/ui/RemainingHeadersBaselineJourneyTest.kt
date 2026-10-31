package org.trustroots.android.ui

import android.content.res.Configuration
import org.trustroots.android.ui.account.AccountSettingsScreen

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.contacts.ContactsScreen
import org.trustroots.android.ui.menu.MenuScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

/** Exercises collapsing headers and preserves screenshots from the pre-change layout. */
@RunWith(AndroidJUnit4::class)
class RemainingHeadersBaselineJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val server = ServerSocket(0).apply { soTimeout = 500 }
    private val session = MemberSession(
        "connect.sid=fictional-header-session",
        MobileMember("quiet-fox", "Quiet Fox"),
    )
    @Volatile private var activeSocket: Socket? = null
    private var responder: Thread? = null

    @Before fun useRealEdgeToEdgeWindowInsets() {
        compose.activityRule.scenario.onActivity { activity ->
            WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        }
    }

    @After fun closeFixture() {
        runCatching { activeSocket?.close() }
        runCatching { server.close() }
        responder?.join(1_000)
        assertEquals("The anonymous fixture responder should stop", false, responder?.isAlive == true)
    }

    @Test fun contactsOverviewBaselineCapturesExpandedAndScrolledHeader() {
        var backPressed = false
        startResponder()
        compose.setContent {
            TrustrootsTheme {
                ContactsScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = { backPressed = true },
                    onOpenProfile = {},
                    contentPadding = WindowInsets.safeDrawing.asPaddingValues(),
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onNodeWithText("Fictional Contact 1").fetchSemanticsNodeOrNull() != null
        }
        val titleTop = compose.onNodeWithText("Contacts").fetchSemanticsNode().boundsInRoot.top
        val backBounds = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        captureUsabilityScreenshot(compose, "android_contacts_header_pinned_baseline")

        compose.onNodeWithTag("contactsList").performTouchInput { swipeUp() }
        captureUsabilityScreenshot(compose, "android_contacts_header_scrolled_baseline")

        compose.onNodeWithText("Contacts").assertIsDisplayed()
        val pinnedTitle = compose.onNodeWithText("Contacts").fetchSemanticsNode().boundsInRoot
        assertEquals("The title stays pinned while contacts scroll", titleTop, pinnedTitle.top, 1f)
        assertTrue(
            "The contacts list scrolls beneath the pinned title",
            compose.onNodeWithTag("contactsList").fetchSemanticsNode()
                .config[SemanticsProperties.VerticalScrollAxisRange].value() > 0f,
        )
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        assertTrue(backPressed)
        compose.onNodeWithTag("contactsList").performTouchInput { swipeDown() }
        assertEquals(titleTop, compose.onNodeWithText("Contacts").fetchSemanticsNode().boundsInRoot.top, 2f)
        assertTrue(backBounds.height > 0f)
    }

    @Test fun accountBaselineCapturesTitleBeforeAndAfterWholeScreenScroll() {
        var backPressed = false
        startResponder()
        compose.setContent {
            TrustrootsTheme {
                AccountSettingsScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = session,
                    onSessionInvalidated = {},
                    onBack = { backPressed = true },
                    onResetPassword = {},
                    onSignedOut = {},
                    contentPadding = WindowInsets.safeDrawing.asPaddingValues(),
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onNodeWithText("quiet@example.test").fetchSemanticsNodeOrNull() != null
        }
        val titleTop = compose.onNodeWithText("Account").fetchSemanticsNode().boundsInRoot.top
        val backBounds = compose.onNodeWithContentDescription("Back").fetchSemanticsNode().boundsInRoot
        captureUsabilityScreenshot(compose, "android_account_header_pinned_baseline")

        compose.onNodeWithTag("accountSettingsScreen").performTouchInput { swipeUp() }
        captureUsabilityScreenshot(compose, "android_account_header_scrolled_baseline")

        val pinnedTitle = compose.onNodeWithText("Account").fetchSemanticsNode().boundsInRoot
        assertEquals("The title stays pinned while account settings scroll", titleTop, pinnedTitle.top, 1f)
        assertTrue(
            "Account settings scroll beneath the pinned title",
            compose.onNodeWithTag("accountSettingsScreen").fetchSemanticsNode()
                .config[SemanticsProperties.VerticalScrollAxisRange].value() > 0f,
        )
        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        assertTrue(backPressed)
        compose.onNodeWithTag("accountSettingsScreen").performTouchInput { swipeDown() }
        assertEquals(titleTop, compose.onNodeWithText("Account").fetchSemanticsNode().boundsInRoot.top, 2f)
        assertTrue(backBounds.height > 0f)
    }

    @Test fun profileDestinationCollapsesAndExpandsWithRtlDarkAppearanceAndRealInsets() {
        var profileOpened = false
        val darkConfiguration = Configuration(compose.activity.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
        }
        val darkContext = compose.activity.createConfigurationContext(darkConfiguration)
        compose.setContent {
            CompositionLocalProvider(
                LocalLayoutDirection provides LayoutDirection.Rtl,
                LocalContext provides darkContext,
                LocalConfiguration provides darkContext.resources.configuration,
            ) {
                MaterialTheme(colorScheme = darkColorScheme()) {
                    MenuScreen(
                        session = session,
                        openProfile = { profileOpened = true },
                        openEditProfile = {},
                        openHost = {},
                        openNostroots = {},
                        openContacts = {},
                        openFindPeople = {},
                        openCircles = {},
                        openAccount = {},
                        openBrowser = {},
                        contentPadding = WindowInsets.safeDrawing.asPaddingValues(),
                    )
                }
            }
        }
        val expandedTop = compose.onNodeWithTag("memberLargeTopAppBarTitle").fetchSemanticsNode().boundsInRoot.top
        captureUsabilityScreenshot(compose, "android_profile_destination_pinned_baseline")
        compose.onNodeWithTag("profileDestinationScreen").performTouchInput { swipeUp() }
        val compactTop = compose.onNodeWithTag("memberLargeTopAppBarTitle").fetchSemanticsNode().boundsInRoot.top
        captureUsabilityScreenshot(compose, "android_profile_destination_scrolled_baseline")
        assertEquals("The profile title stays pinned as the menu scrolls", expandedTop, compactTop, 1f)
        assertTrue(
            "The profile destination content scrolls beneath its pinned title",
            compose.onNodeWithTag("profileDestinationScreen").fetchSemanticsNode()
                .config[SemanticsProperties.VerticalScrollAxisRange].value() > 0f,
        )
        compose.onNodeWithTag("profileDestinationScreen").performTouchInput { swipeDown() }
        compose.onNodeWithText("View your profile").performScrollTo().performClick()
        assertTrue(profileOpened)
    }

    private fun startResponder() {
        responder = thread(isDaemon = true, name = "remaining-header-anonymous-fixture") {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (_: SocketTimeoutException) {
                    continue
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                activeSocket = socket
                try {
                    socket.use { connection ->
                        val input = connection.getInputStream().bufferedReader()
                        val request = input.readLine().orEmpty()
                        while (!input.readLine().isNullOrEmpty()) Unit
                        val payload = when {
                            request.startsWith("GET /api/users/quiet-fox ") -> ACCOUNT_AND_PROFILE
                            request.startsWith("GET /api/contacts/member-self ") -> CONTACTS
                            else -> "[]"
                        }
                        val bytes = payload.toByteArray(Charsets.UTF_8)
                        connection.getOutputStream().apply {
                            write(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                    .toByteArray(Charsets.US_ASCII),
                            )
                            write(bytes)
                            flush()
                        }
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw IOException("Anonymous header fixture failed", error)
                } finally {
                    activeSocket = null
                }
            }
        }
    }

    private fun androidx.compose.ui.test.SemanticsNodeInteraction.fetchSemanticsNodeOrNull() =
        runCatching { fetchSemanticsNode() }.getOrNull()

    private companion object {
        const val ACCOUNT_AND_PROFILE = """{"_id":"member-self","username":"quiet-fox","displayName":"Quiet Fox","email":"quiet@example.test","newsletter":false}"""
        val CONTACTS = (1..20).joinToString(prefix = "[", postfix = "]") { index ->
            """{"_id":"contact-$index","user":{"_id":"contact-member-$index","username":"fictional-contact-$index","displayName":"Fictional Contact $index"}}"""
        }
    }
}
