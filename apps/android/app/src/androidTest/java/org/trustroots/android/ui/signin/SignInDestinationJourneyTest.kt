package org.trustroots.android.ui.signin

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.Resources
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.net.SocketException
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.R
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.SignInJourneyActivity
import org.trustroots.android.ui.LocaleOverlayResources
import org.trustroots.android.ui.TrustrootsApp
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class SignInDestinationJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null
    private val server = ServerSocket(0)
    private val alternateServer = ServerSocket(0)
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val alternateRequests = CopyOnWriteArrayList<CapturedRequest>()
    private val responders = CopyOnWriteArrayList<Thread>()
    private var releaseSignIn: CountDownLatch? = null
    private var receivedSignIn: CountDownLatch? = null

    @Before fun clearSession() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
    }

    @After fun restoreSessionAndStopServer() {
        runCatching { composeScenario?.close() }
        releaseSignIn?.countDown()
        server.close()
        alternateServer.close()
        responders.forEach { it.join(1_000) }
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    private var composeScenario: ActivityScenario<SignInJourneyActivity>? = null

    @Test
    fun signInRequestSurvivesActivityRecreationAndDeliversSuccess() {
        receivedSignIn = CountDownLatch(1)
        releaseSignIn = CountDownLatch(1)
        startResponder { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> {
                    requireNotNull(receivedSignIn).countDown()
                    check(requireNotNull(releaseSignIn).await(10, TimeUnit.SECONDS))
                    Response(
                        "200 OK",
                        """{"username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                        "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                    )
                }
                request.line.startsWith("GET /api/users/anonymous-heron ") -> Response(
                    "200 OK",
                    """{"_id":"member-self","username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                )
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                request.line.contains("/avatar?") -> Response("404 Not Found", "")
                else -> Response("404 Not Found", "")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        compose.waitUntil(10_000) { requireNotNull(receivedSignIn).count == 0L }

        scenario.recreate()
        waitForSignIn()
        assertEditableText("signin-username", "anonymous-heron")
        assertPasswordMaskedAndRetained("fictional-password")
        compose.onNode(hasProgressBarRangeInfo(androidx.compose.ui.semantics.ProgressBarRangeInfo.Indeterminate))
            .assertIsDisplayed()
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })

        requireNotNull(releaseSignIn).countDown()
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("Discover circles").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })
        assertEquals("connect.sid=fictional-session", SecureMobileSessionStore(context).load()?.cookieHeader)
        assertEquals("anonymous-heron", SecureMobileSessionStore(context).load()?.member?.username)
    }

    @Test
    fun signInResourcesAndPurposeTitlesUpdateWithLocaleWhileFormEntryIsRetained() {
        val scenario = launchActivity()
        composeScenario = scenario
        lateinit var englishResources: Resources
        lateinit var frenchResources: Resources

        scenario.onActivity { activity ->
            englishResources = LocaleOverlayResources(activity.resources, Locale.ENGLISH)
            frenchResources = LocaleOverlayResources(activity.resources, Locale.FRENCH)

            activity.setContent {
                var useFrench by remember { mutableStateOf(false) }
                val localeResources = if (useFrench) frenchResources else englishResources
                CompositionLocalProvider(
                    LocalContext provides activity,
                    LocalConfiguration provides localeResources.configuration,
                    LocalResources provides localeResources,
                ) {
                    TrustrootsTheme {
                        Box(Modifier.fillMaxSize()) {
                            TrustrootsApp(
                                apiBaseUrl = apiBaseUrl,
                                reconcileAlerts = { _, _ -> },
                                browserContent = { route, onClose, padding ->
                                    Column(Modifier.padding(padding)) {
                                        Text(route.title)
                                        Text(route.url)
                                        TextButton(onClick = onClose) { Text("Close test browser") }
                                    }
                                },
                            )
                            TextButton(
                                onClick = { useFrench = !useFrench },
                                modifier = Modifier.align(Alignment.TopEnd),
                            ) {
                                Text("Change test locale")
                            }
                        }
                    }
                }
            }
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("English test username or email").fetchSemanticsNodes().isNotEmpty()
        }
        assertSignInLabels("English")
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-otter")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")

        compose.onNodeWithText("Change test locale").performClick()
        assertSignInLabels("French")
        assertEditableText("signin-username", "anonymous-otter")
        assertPasswordMaskedAndRetained("fictional-password")

        compose.onNodeWithText("French test join").performScrollTo().performClick()
        compose.onNodeWithText("French test Join Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Change test locale").performClick()
        compose.onNodeWithText("English test Join Trustroots").assertIsDisplayed()
        compose.onNodeWithText("Close test browser").performClick()
        assertEditableText("signin-username", "anonymous-otter")
        assertPasswordMaskedAndRetained("fictional-password")

        compose.onNodeWithText("English test forgot password").performScrollTo().performClick()
        compose.onNodeWithText("English test Reset password").assertIsDisplayed()
        compose.onNodeWithText("Change test locale").performClick()
        compose.onNodeWithText("French test Reset password").assertIsDisplayed()
        compose.onNodeWithText("Close test browser").performClick()
        assertEditableText("signin-username", "anonymous-otter")
        assertPasswordMaskedAndRetained("fictional-password")
    }

    @Test
    fun backendChangeDuringSignInClearsCredentialsAndRejectsTheOldResult() {
        receivedSignIn = CountDownLatch(1)
        releaseSignIn = CountDownLatch(1)
        val receivedNewBackendRequest = CountDownLatch(1)
        val releaseNewBackendResponse = CountDownLatch(1)
        startResponder(server) { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> {
                    requireNotNull(receivedSignIn).countDown()
                    check(requireNotNull(releaseSignIn).await(10, TimeUnit.SECONDS))
                    Response(
                        "200 OK",
                        """{"username":"old-backend-member","displayName":"Old Backend Member"}""",
                        "Set-Cookie: connect.sid=old-backend-session; Path=/; HttpOnly\r\n",
                    )
                }
                request.line.contains("/api/tribes?limit=150 ") ||
                    request.line.contains("/api/users/memberships ") ||
                    request.line.contains("/api/messages?") -> Response("200 OK", "[]")
                else -> Response("200 OK", "{}")
            }
        }
        startResponder(alternateServer, alternateRequests) { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> {
                    receivedNewBackendRequest.countDown()
                    check(releaseNewBackendResponse.await(10, TimeUnit.SECONDS))
                    Response(
                        "200 OK",
                        """{"username":"new-backend-member","displayName":"New Backend Member"}""",
                        "Set-Cookie: connect.sid=new-backend-session; Path=/; HttpOnly\r\n",
                    )
                }
                request.line.contains("/api/tribes?limit=150 ") ||
                    request.line.contains("/api/users/memberships ") ||
                    request.line.contains("/api/messages?") -> Response("200 OK", "[]")
                else -> Response("200 OK", "{}")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("old-backend-member")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-old-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        assertTrue(requireNotNull(receivedSignIn).await(10, TimeUnit.SECONDS))

        scenario.onActivity { activity ->
            activity.intent.putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, alternateApiBaseUrl)
        }
        scenario.recreate()
        waitForSignIn()
        assertEditableText("signin-username", "")
        assertEditableText("signin-password", "")
        assertNull(SecureMobileSessionStore(context).load())

        compose.onNodeWithTag("signin-username").performTextInput("new-backend-member")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-new-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        requireNotNull(releaseSignIn).countDown()
        assertTrue(receivedNewBackendRequest.await(10, TimeUnit.SECONDS))
        compose.waitForIdle()
        assertNull("The old backend response must not create a session", SecureMobileSessionStore(context).load())

        releaseNewBackendResponse.countDown()
        waitForText("Discover circles")
        assertEquals("new-backend-member", SecureMobileSessionStore(context).load()?.member?.username)
        assertEquals("connect.sid=new-backend-session", SecureMobileSessionStore(context).load()?.cookieHeader)
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })
        assertEquals(1, alternateRequests.count { it.line.startsWith("POST /api/auth/signin ") })
    }

    @Test
    fun signInBrowserHistorySurvivesRecreationThenBackReturnsToItsFormEntry() {
        startResponder { request ->
            when {
                request.line.startsWith("GET /browser/signup ") -> Response(
                    "200 OK",
                    "<html><head><title>Local signup origin</title></head><body>Signup origin</body></html>",
                    contentType = "text/html; charset=utf-8",
                )
                request.line.startsWith("GET /browser/second ") -> Response(
                    "200 OK",
                    "<html><head><title>Local signup history</title></head><body>Second page</body></html>",
                    contentType = "text/html; charset=utf-8",
                )
                else -> Response("404 Not Found", "Missing local browser page")
            }
        }
        val scenario = launchActivity(browserBaseUrl = "$apiBaseUrl/browser")
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithText("Join").performScrollTo().performClick()
        val signupURL = "$apiBaseUrl/browser/signup"
        val historyURL = "$apiBaseUrl/browser/second"
        awaitWebViewPage(scenario, signupURL, "Local signup origin", canGoBack = false)

        scenario.onActivity { activity ->
            requireNotNull(findWebView(activity.window.decorView)).loadUrl(historyURL)
        }
        awaitWebViewPage(scenario, historyURL, "Local signup history", canGoBack = true)
        scenario.recreate()
        awaitWebViewPage(scenario, historyURL, "Local signup history", canGoBack = true)

        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        awaitWebViewPage(scenario, signupURL, "Local signup origin", canGoBack = false)
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        waitForSignIn()
        assertEditableText("signin-username", "anonymous-heron")
        assertEquals(0, requests.count { it.line.startsWith("POST /api/auth/signin ") })
    }

    @Test
    fun signingOutCreatesFreshSignInFieldsAndDoesNotReplayOldErrorOrSuccess() {
        var signInCount = 0
        startResponder { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> {
                    signInCount++
                    if (signInCount == 1) {
                        Response(
                            "200 OK",
                            """{"username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                            "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                        )
                    } else {
                        Response("401 Unauthorized", """{"message":"Those credentials were not accepted."}""")
                    }
                }
                request.line.startsWith("GET /api/users/anonymous-heron ") -> Response(
                    "200 OK",
                    """{"_id":"member-self","username":"anonymous-heron","displayName":"Anonymous Heron","email":"anonymous@example.test","newsletter":false}""",
                )
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "POST /api/auth/signout HTTP/1.1" -> Response("200 OK", "{}")
                request.line.contains("/avatar?") -> Response("404 Not Found", "")
                else -> Response("404 Not Found", "")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        waitForText("anonymous@example.test")
        compose.onNodeWithText("Sign out").performScrollTo()
        compose.onNodeWithTag("accountSettingsScreen").performTouchInput {
            swipeUp(startY = height * 0.7f, endY = height * 0.2f)
        }
        val signOutBounds = compose.onNodeWithText("Sign out").fetchSemanticsNode().boundsInRoot
        val navigationBounds = compose.onNodeWithTag("navigation-circles").fetchSemanticsNode().boundsInRoot
        assertTrue(
            "Sign out must be reachable above the navigation bar",
            signOutBounds.bottom <= navigationBounds.top,
        )
        compose.onNodeWithText("Sign out").assertIsDisplayed().performClick()
        waitForSignIn()

        assertEditableText("signin-username", "")
        assertEditableText("signin-password", "")
        assertTrue(compose.onAllNodesWithText("anonymous-heron").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Those credentials were not accepted.").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Your session expired or is no longer valid. Please sign in again.")
            .fetchSemanticsNodes().isEmpty())
        assertNull(SecureMobileSessionStore(context).load())
        assertTrue(requests.any { it.line.startsWith("POST /api/auth/signout ") })
    }

    @Test
    fun restoredSessionStaysInTheAuthenticatedShellAfterActivityRecreation() {
        SecureMobileSessionStore(context).save(
            MemberSession(
                cookieHeader = "connect.sid=fictional-restored-session",
                member = MobileMember("quiet-heron", "Quiet Heron"),
            ),
        )
        startResponder { request ->
            when {
                request.line.startsWith("GET /api/users/quiet-heron ") -> Response(
                    "200 OK",
                    """{"_id":"member-safe-id","username":"quiet-heron","displayName":"Quiet Heron"}""",
                )
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                request.line.contains("/avatar?") -> Response("404 Not Found", "")
                else -> Response("404 Not Found", "")
            }
        }

        val scenario = launchActivity()
        composeScenario = scenario
        waitForText("Discover circles")
        assertTrue(compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isEmpty())

        scenario.recreate()
        waitForText("Discover circles")

        assertTrue(compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isEmpty())
        assertEquals("connect.sid=fictional-restored-session", SecureMobileSessionStore(context).load()?.cookieHeader)
        assertEquals("quiet-heron", SecureMobileSessionStore(context).load()?.member?.username)
    }

    @Test
    fun expiredSessionAfterSuccessfulSignInOpensFreshFormWithExpiryMessage() {
        val expireOwnProfile = AtomicBoolean(false)
        val successfulOwnProfileReads = AtomicInteger()
        val expiredOwnProfileReads = AtomicInteger()
        startResponder { request ->
            when {
                request.line.startsWith("POST /api/auth/signin ") -> Response(
                    "200 OK",
                    """{"username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                    "Set-Cookie: connect.sid=fictional-session; Path=/; HttpOnly\r\n",
                )
                request.line.startsWith("GET /api/users/anonymous-heron ") -> {
                    if (expireOwnProfile.get()) {
                        expiredOwnProfileReads.incrementAndGet()
                        Response("401 Unauthorized", """{"message":"Session expired."}""")
                    } else {
                        successfulOwnProfileReads.incrementAndGet()
                        Response(
                            "200 OK",
                            """{"_id":"member-self","username":"anonymous-heron","displayName":"Anonymous Heron"}""",
                        )
                    }
                }
                request.line.startsWith("GET /api/messages?") -> Response("200 OK", "[]")
                request.line == "GET /api/tribes?limit=150 HTTP/1.1" -> Response("200 OK", "[]")
                request.line == "GET /api/users/memberships HTTP/1.1" -> Response("200 OK", "[]")
                else -> Response("404 Not Found", "")
            }
        }
        val scenario = launchActivity()
        composeScenario = scenario
        waitForSignIn()
        compose.onNodeWithTag("signin-username").performTextInput("anonymous-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")
        compose.waitUntil(5_000) { successfulOwnProfileReads.get() >= 1 }

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("View your profile").performScrollTo()
        expireOwnProfile.set(true)
        compose.onNodeWithText("View your profile").performClick()
        waitForText("Your session expired or is no longer valid. Please sign in again.")
        waitForSignIn()
        assertEquals(
            "Only the explicit profile visit should receive the expiry response",
            1,
            expiredOwnProfileReads.get(),
        )

        compose.onNodeWithText("Your session expired or is no longer valid. Please sign in again.")
            .performScrollTo().assertIsDisplayed()
        assertTrue(requests.any { it.line.startsWith("GET /api/users/anonymous-heron ") })
        assertEditableText("signin-username", "")
        assertEditableText("signin-password", "")
        assertEquals(1, requests.count { it.line.startsWith("POST /api/auth/signin ") })
        assertNull(SecureMobileSessionStore(context).load())
    }

    private fun launchActivity(browserBaseUrl: String? = null): ActivityScenario<SignInJourneyActivity> {
        val intent = Intent(context, SignInJourneyActivity::class.java)
            .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, apiBaseUrl)
        browserBaseUrl?.let { intent.putExtra(SignInJourneyActivity.BROWSER_BASE_URL_EXTRA, it) }
        return ActivityScenario.launch(intent)
    }

    private val apiBaseUrl: String get() = "http://127.0.0.1:${server.localPort}"
    private val alternateApiBaseUrl: String get() = "http://127.0.0.1:${alternateServer.localPort}"

    private fun restorePreferences(preferences: SharedPreferences, values: Map<String, *>) {
        val editor = preferences.edit().clear()
        values.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }

    private fun waitForSignIn() {
        try {
            compose.waitUntil(10_000) {
                compose.onAllNodesWithText("Username or email").fetchSemanticsNodes().isNotEmpty()
            }
        } catch (error: ComposeTimeoutException) {
            compose.onRoot(useUnmergedTree = true).printToLog("sign-in-form-not-returned")
            val sessionPresent = SecureMobileSessionStore(context).load() != null
            throw AssertionError(
                "Sign-in form did not return. Requests: ${requests.joinToString { it.line }}; " +
                    "savedSessionPresent=$sessionPresent",
                error,
            )
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun awaitWebViewPage(
        scenario: ActivityScenario<SignInJourneyActivity>,
        url: String,
        title: String,
        canGoBack: Boolean,
    ) {
        compose.waitUntil("WebView page $url to load", 10_000) {
            var ready = false
            scenario.onActivity { activity ->
                findWebView(activity.window.decorView)?.let { webView ->
                    ready = webView.url == url && webView.progress == 100 &&
                        webView.title == title && webView.canGoBack() == canGoBack
                }
            }
            ready
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }

    private fun assertEditableText(testTag: String, expected: String) {
        val actual = compose.onNodeWithTag(testTag).fetchSemanticsNode()
            .config[SemanticsProperties.EditableText].text
        assertEquals(expected, actual)
    }

    private fun assertPasswordMaskedAndRetained(password: String) {
        val actual = compose.onNodeWithTag("signin-password").fetchSemanticsNode()
            .config[SemanticsProperties.EditableText].text
        assertEquals("•".repeat(password.length), actual)
        assertTrue(actual != password)
    }

    private fun assertSignInLabels(language: String) {
        compose.onNodeWithContentDescription("$language test Trustroots").assertExists()
        compose.onNodeWithText("$language test travellers’ community").assertExists()
        compose.onNodeWithText("$language test sharing, hosting and getting people together").assertExists()
        compose.onNodeWithText("$language test username or email").assertExists()
        compose.onNodeWithText("$language test password").assertExists()
        compose.onNodeWithText("$language test sign in").assertExists()
        compose.onNodeWithText("$language test join").assertExists()
        compose.onNodeWithText("$language test forgot password").assertExists()
        compose.onNodeWithText("$language test build", substring = true).assertExists()
    }

    private fun startResponder(
        fixtureServer: ServerSocket = server,
        capturedRequests: MutableList<CapturedRequest> = requests,
        responseFor: (CapturedRequest) -> Response,
    ) {
        responders += thread(isDaemon = true, name = "sign-in-destination-fixture") {
            while (!fixtureServer.isClosed) {
                val socket = try {
                    fixtureServer.accept()
                } catch (error: SocketException) {
                    if (fixtureServer.isClosed) break else throw error
                }
                socket.use { connection ->
                    val input = connection.getInputStream().bufferedReader()
                    val line = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine().orEmpty()
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    val body = CharArray(contentLength)
                    var offset = 0
                    while (offset < body.size) {
                        val count = input.read(body, offset, body.size - offset)
                        if (count < 0) break
                        offset += count
                    }
                    val request = CapturedRequest(line, body.concatToString())
                    capturedRequests += request
                    val response = responseFor(request)
                    val bytes = response.body.toByteArray()
                    runCatching {
                        connection.getOutputStream().apply {
                            val headers = (
                                "HTTP/1.1 ${response.status}\r\nContent-Type: ${response.contentType}\r\n" +
                                    response.extraHeaders + "Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                ).toByteArray()
                            write(headers)
                            write(bytes)
                            flush()
                        }
                    }
                }
            }
        }
    }

    private data class CapturedRequest(val line: String, val body: String)

    private data class Response(
        val status: String,
        val body: String,
        val extraHeaders: String = "",
        val contentType: String = "application/json",
    )
}
