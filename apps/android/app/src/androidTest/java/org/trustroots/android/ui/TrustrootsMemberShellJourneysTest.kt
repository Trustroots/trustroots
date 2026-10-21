package org.trustroots.android.ui

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToLog
import androidx.compose.ui.test.swipeDown
import androidx.test.core.app.ApplicationProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination

@RunWith(AndroidJUnit4::class)
class TrustrootsMemberShellJourneysTest {
    @get:Rule val compose = createEmptyComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = ServerSocket(0)
    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val sessionPreferences by lazy {
        context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE)
    }
    private val alertPreferences by lazy {
        context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE)
    }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousDestination: MessageDestination? = null
    private var previousStatus: String? = null
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    private var responder: Thread? = null
    @Volatile private var expireExperienceSubmissions = false
    private val experienceSubmissionCount = java.util.concurrent.atomic.AtomicInteger()

    @Before fun prepareIsolatedShell() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousDestination = MessageAlerts.destination.value
        previousStatus = MessageAlerts.status.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        MessageAlerts.status.value = null
        startResponder()
    }

    @After fun restoreStateAndStopResponder() {
        scenario?.close()
        server.close()
        responder?.join(1_000)
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousDestination
        MessageAlerts.status.value = previousStatus
    }

    @Test fun menuCirclesShortcutReturnsToItsMenuOriginAfterActivityRecreation() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNode(
            hasText("Circles") and hasAnyAncestor(hasTestTag("profileDestinationScreen")),
        ).performScrollTo().performClick()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-circles").assertIsSelected()

        requireNotNull(scenario).recreate()
        waitForText("Discover circles")
        requireNotNull(scenario).onActivity { activity ->
            activity.onBackPressedDispatcher.onBackPressed()
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("profileDestinationScreen").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("profileDestinationScreen").assertIsDisplayed()
        compose.onNodeWithTag("navigation-menu").assertIsSelected()
    }

    @Test fun contactsOpenAMemberProfileAndBackReturnsToTheContactList() {
        showShell()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")

        requireNotNull(scenario).recreate()
        waitForText("A welcoming place to pause.")
        assertEquals(1, requests.count { it.path == "/api/contacts/member-self" })

        compose.onNodeWithTag("navigation-menu").performClick()
        waitForText("View your profile")
        compose.onNodeWithText("A welcoming place to pause.").assertDoesNotExist()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        assertEquals(2, requests.count { it.path == "/api/contacts/member-self" })
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")

        compose.onNodeWithText("A welcoming place to pause.").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A welcoming place to pause.").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        compose.onNodeWithText("Send a message").assertDoesNotExist()

        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        pressSystemBack()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A welcoming place to pause.").fetchSemanticsNodes().isEmpty() &&
                compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(requests.any { it.path == "/api/contacts/member-self" })
        assertTrue(requests.any { it.path == "/api/users/quiet-fox" })
    }

    @Test fun relatedProfileIsAnEntryAndRecreationBackRestoresItsOpenerWithoutReloading() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithText("Reference Author").performScrollTo().performClick()
        waitForText("@reference-author")
        assertEquals(1, requests.count { it.path == "/api/users/quiet-fox" })
        assertEquals(1, requests.count { it.path == "/api/users/reference-author" })

        requireNotNull(scenario).recreate()
        waitForText("@reference-author")
        assertEquals(1, requests.count { it.path == "/api/users/quiet-fox" })
        assertEquals(1, requests.count { it.path == "/api/users/reference-author" })
        compose.onNodeWithContentDescription("Back").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Reference Author").fetchSemanticsNodes().isNotEmpty()
        }
        revealProfileTabsIfClipped()
        compose.onNodeWithTag("profileSection-experiences").assertIsSelected()
        compose.onNodeWithText("Reference Author").assertIsDisplayed()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertEquals(1, requests.count { it.path == "/api/users/quiet-fox" })
        assertEquals(1, requests.count { it.path == "/api/users/reference-author" })
    }

    @Test fun profileConversationHasItsOwnEntryAndReturnsThroughTheSameProfileVisit() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithText("Send a message").performClick()
        waitForText("Fictional route message")
        assertEquals("the message entry resolves its member independently", 1, requests.count {
            it.path == "/api/users/mini/member-one"
        })
        assertEquals(1, requests.count { it.path == "/api/messages/member-one?limit=100" })
        assertEquals(1, requests.count { it.path == "/api/users/quiet-fox" })
        assertEquals(session.cookieHeader, requests.first { it.path == "/api/users/mini/member-one" }.cookie)
        assertEquals(session.cookieHeader, requests.first { it.path == "/api/messages/member-one?limit=100" }.cookie)

        requireNotNull(scenario).recreate()
        waitForText("Fictional route message")
        assertEquals("conversation restoration retains its recipient state", 1, requests.count {
            it.path == "/api/users/mini/member-one"
        })
        assertEquals("conversation restoration retains its loaded messages", 1, requests.count {
            it.path == "/api/messages/member-one?limit=100"
        })

        compose.onNodeWithText("View profile").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithTag("profileSection-about").assertIsSelected()
        assertEquals("opening a profile from Conversation creates its own profile entry", 2, requests.count {
            it.path == "/api/users/quiet-fox"
        })
        pressSystemBack()
        waitForText("Fictional route message")
        compose.onNodeWithContentDescription("Back").performClick()
        try {
            waitForText("Reference Author")
        } catch (failure: Throwable) {
            compose.onRoot(useUnmergedTree = true).printToLog("profile-conversation-toolbar-back")
            throw AssertionError(
                "Conversation toolbar Back did not restore the parent profile; requests=${requests.map { it.method to it.path }}",
                failure,
            )
        }
        compose.onNodeWithTag("profileSection-experiences").assertIsSelected()
        compose.onNodeWithText("Reference Author").assertIsDisplayed()
        assertEquals("returning to the original profile does not reload it", 2, requests.count {
            it.path == "/api/users/quiet-fox"
        })
        assertEquals("Contacts remains below the profile route", 1, requests.count {
            it.path == "/api/contacts/member-self"
        })
    }

    @Test fun profileBrowserEntryRestoresRuntimeSessionAndClosesToItsProfile() {
        showShell(fakeBrowser = true)
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithContentDescription("More profile actions").performClick()
        waitForText("Add contact")
        compose.onNodeWithText("Add contact").performClick()
        waitForText("Fake browser: Add contact")
        compose.onNodeWithText("https://www.trustroots.org/contact-add/member-one").assertIsDisplayed()
        compose.onNodeWithText("Runtime session: ${session.cookieHeader}").assertIsDisplayed()

        requireNotNull(scenario).recreate()
        waitForText("Fake browser: Add contact")
        compose.onNodeWithText("Runtime session: ${session.cookieHeader}").assertIsDisplayed()
        compose.onNodeWithText("Close fake browser").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithTag("profileSection-about").assertIsSelected()
        assertEquals("browser Back returns to its exact profile entry", 1, requests.count {
            it.path == "/api/users/quiet-fox"
        })
    }

    @Test fun profileBrowserHistoryBackStaysInsideEntryAfterActivityRecreation() {
        showShell(profileBrowserURL = "about:blank")
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithContentDescription("More profile actions").performClick()
        waitForText("Add contact")
        compose.onNodeWithText("Add contact").performClick()
        waitForText("Add contact")
        awaitWebView(url = "about:blank", canGoBack = false)

        requireNotNull(scenario).onActivity { activity ->
            requireNotNull(findWebView(activity.window.decorView)).loadUrl("about:blank#second")
        }
        awaitWebView(url = "about:blank#second", canGoBack = true)
        requireNotNull(scenario).recreate()
        awaitWebView(url = "about:blank#second", canGoBack = true)

        pressSystemBack()
        awaitWebView(url = "about:blank", canGoBack = false)
        compose.onNodeWithText("Add contact").assertIsDisplayed()
        pressSystemBack()
        waitForText("A welcoming place to pause.")
        assertEquals("browser-history Back does not refetch its profile owner", 1, requests.count {
            it.path == "/api/users/quiet-fox"
        })
    }

    @Test fun savingOwnProfileUpdatesThePersistedShellMember() {
        SecureMobileSessionStore(context).save(session)
        showShell()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("View your profile").performScrollTo().performClick()
        waitForText("A calm place to land.")
        compose.onNodeWithText("Edit your profile").performClick()
        compose.onNodeWithText("Name").performTextReplacement("Updated Heron")
        compose.onNodeWithText("Tagline").performTextReplacement("A brighter place to land.")
        compose.onNodeWithText("Save changes").performClick()

        waitForText("A brighter place to land.")
        compose.onNodeWithText("A brighter place to land.").assertIsDisplayed()
        compose.waitUntil(5_000) {
            SecureMobileSessionStore(context).load()?.member?.displayName == "Updated Heron"
        }
        val update = requests.lastOrNull { it.method == "PUT" && it.path == "/api/users" }
            ?: error("Expected the profile update request")
        assertEquals("Updated Heron", JSONObject(update.body).getString("displayName"))
        assertEquals("A brighter place to land.", JSONObject(update.body).getString("tagline"))
        assertEquals("Updated Heron", SecureMobileSessionStore(context).load()?.member?.displayName)
    }

    @Test fun experienceDraftSurvivesActivityRecreationAndReturnsToItsProfileEntry() {
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithTag("profileSection-experiences").performClick()
        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.onNodeWithText("Share your experience").performClick()
        compose.onNodeWithText("Public experience (optional)")
            .performTextReplacement("A fictional draft retained by this visit.")

        requireNotNull(scenario).recreate()

        waitForText("A fictional draft retained by this visit.")
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("A fictional draft retained by this visit.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.onNodeWithText("Discard changes").performClick()
        compose.onNodeWithTag("profileSection-experiences").assertIsSelected()
        compose.onNodeWithText("Quiet Fox").assertIsDisplayed()
        assertTrue(requests.none { it.method == "POST" && it.path == "/api/experiences" })
    }

    @Test fun expiredExperienceClearsShellAndSameAccountLoginGetsFreshFormStore() {
        expireExperienceSubmissions = true
        showShell()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.onNodeWithText("Share your experience").performClick()
        val discardedDraft = "A fictional draft from an expired session."
        compose.onNodeWithText("Public experience (optional)")
            .performTextInput(discardedDraft)
        compose.onNodeWithText("Save changes").performClick()

        waitForText("Your session expired or is no longer valid. Please sign in again.")
        assertEquals(1, experienceSubmissionCount.get())
        assertEquals(null, SecureMobileSessionStore(context).load())
        assertTrue(compose.onAllNodesWithText(discardedDraft).fetchSemanticsNodes().isEmpty())

        compose.onNodeWithTag("signin-username").performTextInput("steady-heron")
        compose.onNodeWithTag("signin-password").performTextInput("fictional-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")
        assertEquals("steady-heron", SecureMobileSessionStore(context).load()?.member?.username)
        assertEquals("connect.sid=renewed-fictional-session", SecureMobileSessionStore(context).load()?.cookieHeader)

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("Quiet Fox")
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A welcoming place to pause.")
        compose.onNodeWithContentDescription("More profile actions").performClick()
        compose.onNodeWithText("Share your experience").performClick()
        compose.onNodeWithText("Experience with Quiet Fox").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText(discardedDraft).fetchSemanticsNodes().isEmpty())
        assertEquals("The expired form must not replay after login", 1, experienceSubmissionCount.get())
        assertTrue(
            "The restored shell must load the same account with the renewed cookie",
            requests.any {
                it.method == "GET" && it.path == "/api/users/quiet-fox" &&
                    it.cookie == "connect.sid=renewed-fictional-session"
            },
        )
    }

    @Test fun shellNavigationWaitsForAnExplicitDecisionOnUnsavedProfileChanges() {
        SecureMobileSessionStore(context).save(session)
        showShell()

        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        waitForText("Save changes")
        compose.onNodeWithText("Tagline").performTextReplacement("An unsaved change")
        requireNotNull(scenario).recreate()
        waitForText("An unsaved change")
        assertTrue(requests.none { it.method == "PUT" && it.path == "/api/users" })

        compose.onNodeWithTag("navigation-messages").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("An unsaved change").assertIsDisplayed()

        compose.onNodeWithTag("navigation-messages").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Discard changes").performClick()
        waitForText("No conversations yet.")

        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        assertTrue(requests.none { it.method == "PUT" && it.path == "/api/users" })
    }

    private fun showShell(fakeBrowser: Boolean = false, profileBrowserURL: String? = null) {
        SecureMobileSessionStore(context).save(session)
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, "http://127.0.0.1:${server.localPort}")
                .putExtra(SignInJourneyActivity.FAKE_BROWSER_EXTRA, fakeBrowser)
                .putExtra(SignInJourneyActivity.PROFILE_BROWSER_URL_EXTRA, profileBrowserURL),
        )
    }

    private fun pressSystemBack() {
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun revealProfileTabsIfClipped() {
        val heroBottom = compose.onNodeWithTag("profileHero").fetchSemanticsNode().boundsInRoot.bottom
        val tabs = compose.onAllNodesWithTag("profileSections").fetchSemanticsNodes().firstOrNull()
        if (tabs == null || tabs.boundsInRoot.bottom > heroBottom + 1f) {
            compose.onNodeWithTag("profilePager").performTouchInput { swipeDown() }
        }
        compose.onNodeWithTag("profileSections").assertIsDisplayed()
    }

    private fun awaitWebView(url: String, canGoBack: Boolean) {
        compose.waitUntil(10_000) {
            var matches = false
            requireNotNull(scenario).onActivity { activity ->
                val webView = findWebView(activity.window.decorView)
                matches = webView?.url == url && webView.canGoBack() == canGoBack && webView.progress == 100
            }
            matches
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) findWebView(view.getChildAt(index))?.let { return it }
        }
        return null
    }

    private fun startResponder() {
        responder = thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) break else throw error
                }
                try {
                    socket.use {
                        val input = socket.getInputStream().bufferedReader()
                        val requestLine = input.readLine().orEmpty()
                        var contentLength = 0
                        var cookie = ""
                        while (true) {
                            val header = input.readLine().orEmpty()
                            if (header.isEmpty()) break
                            if (header.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = header.substringAfter(':').trim().toInt()
                            }
                            if (header.startsWith("Cookie:", ignoreCase = true)) {
                                cookie = header.substringAfter(':').trim()
                            }
                        }
                        val bodyBuffer = CharArray(contentLength)
                        var bodyOffset = 0
                        while (bodyOffset < bodyBuffer.size) {
                            val count = input.read(bodyBuffer, bodyOffset, bodyBuffer.size - bodyOffset)
                            if (count < 0) break
                            bodyOffset += count
                        }
                        val body = bodyBuffer.concatToString(0, bodyOffset)
                        val method = requestLine.substringBefore(' ')
                        val path = requestLine.substringAfter(' ').substringBefore(' ')
                        requests += CapturedRequest(method, path, body, cookie)
                        val response = responseFor(method, path, body)
                        val bytes = response.body.toByteArray()
                        socket.getOutputStream().write(
                            "HTTP/1.1 ${response.status}\r\nContent-Type: application/json\r\n${response.headers}Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                        )
                        socket.getOutputStream().write(bytes)
                        socket.getOutputStream().flush()
                    }
                } catch (error: IOException) {
                    if (!server.isClosed) throw error
                }
            }
        }
    }

    private fun responseFor(method: String, path: String, body: String): FixtureResponse = when {
        method == "POST" && path == "/api/auth/signin" -> FixtureResponse(
            "200 OK",
            """{"username":"steady-heron","displayName":"Steady Heron"}""",
            "Set-Cookie: connect.sid=renewed-fictional-session; Path=/; HttpOnly\r\n",
        )
        method == "POST" && path == "/api/experiences" -> {
            val attempt = experienceSubmissionCount.incrementAndGet()
            if (expireExperienceSubmissions && attempt == 1) {
                FixtureResponse("401 Unauthorized", """{"message":"Session expired."}""")
            } else {
                FixtureResponse("201 Created", "{}")
            }
        }
        path.contains("/avatar?") -> FixtureResponse("404 Not Found", "")
        method == "PUT" && path == "/api/users" -> {
            val update = JSONObject(body)
            FixtureResponse(
                "200 OK",
                update
                    .put("_id", "member-self")
                    .put("username", "steady-heron")
                    .put("email", "heron@example.test")
                    .put("newsletter", false)
                    .toString(),
            )
        }
        path == "/api/users/steady-heron" -> FixtureResponse(
            "200 OK",
            """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","email":"heron@example.test","newsletter":false,"tagline":"A calm place to land.","description":"Hello travellers","languages":["eng"]}""",
        )
        path == "/api/users/quiet-fox" -> FixtureResponse(
            "200 OK",
            """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A welcoming place to pause.","description":"A neighbour who enjoys slow journeys.","languages":["por"]}""",
        )
        path == "/api/users/mini/member-one" -> FixtureResponse(
            "200 OK",
            """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}""",
        )
        path == "/api/users/reference-author" -> FixtureResponse(
            "200 OK", """{"_id":"member-reference","username":"reference-author","displayName":"Reference Author"}""",
        )
        path.startsWith("/api/messages?") -> FixtureResponse("200 OK", "[]")
        path == "/api/messages/member-one?limit=100" -> FixtureResponse(
            "200 OK",
            """[{"_id":"message-one","content":"Fictional route message","userFrom":{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox"}}]""",
        )
        path == "/api/tribes?limit=150" -> FixtureResponse("200 OK", "[]")
        path == "/api/users/memberships" -> FixtureResponse("200 OK", "[]")
        path == "/api/contacts/member-self" -> FixtureResponse("200 OK", CONTACTS)
        path.startsWith("/api/contacts/") -> FixtureResponse("200 OK", "[]")
        path.startsWith("/api/offers-by/") -> FixtureResponse("200 OK", "[]")
        path == "/api/experiences?userTo=member-one" -> FixtureResponse(
            "200 OK",
            """[{"_id":"experience-one","userFrom":{"_id":"member-reference","username":"reference-author","displayName":"Reference Author"},"feedbackPublic":"A generous and thoughtful visit.","recommend":"yes"}]""",
        )
        path.startsWith("/api/experiences?") -> FixtureResponse("200 OK", "[]")
        path.startsWith("/api/contact-by/") -> FixtureResponse("404 Not Found", "")
        else -> FixtureResponse("404 Not Found", "")
    }

    private fun restorePreferences(preferences: SharedPreferences, values: Map<String, *>) {
        preferences.edit().clear().commit()
        val editor = preferences.edit()
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

    private data class CapturedRequest(val method: String, val path: String, val body: String, val cookie: String?)
    private data class FixtureResponse(
        val status: String,
        val body: String,
        val headers: String = "",
    )

    private companion object {
        val CONTACTS = JSONArray()
            .put(
                JSONObject()
                    .put("_id", "contact-one")
                    .put(
                        "user",
                        JSONObject()
                            .put("_id", "member-one")
                            .put("username", "quiet-fox")
                            .put("displayName", "Quiet Fox"),
                    ),
            )
            .toString()
    }
}
