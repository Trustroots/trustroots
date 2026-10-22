package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import android.view.WindowManager
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.testing.pressBackFromNonActivityRoot
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.ui.editprofile.EditProfileScreen
import org.trustroots.android.ui.common.languageName

@RunWith(AndroidJUnit4::class)
class ProfileLanguageAndFailureJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Before fun resizeForKeyboardLikeTheMainActivity() {
        compose.activityRule.scenario.onActivity { activity ->
            activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    private val session = MemberSession(
        "connect.sid=fictional-session",
        MobileMember("quiet-fox", "Quiet Fox"),
    )
    private var fixture: ProfileUpdateFixture? = null

    @After fun stopOfflineApi() {
        fixture?.close()
    }

    @Test fun languageDropdownAddsAndRemovesLanguagesIncludingUnknownFallback() {
        assertEquals("ZZX", languageName(UNKNOWN_LANGUAGE))
        val apiFixture = startFixture(expectedRequests = 1) { _, _ ->
            FixtureResponse(
                200,
                """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A quiet place to pause.","description":"Hello travellers.","languages":["eng","spa"]}""",
            )
        }
        val saved = AtomicBoolean(false)

        compose.setContent {
            TrustrootsTheme {
                EditProfileScreen(
                    api = api(apiFixture),
                    session = session,
                    profile = profile(languages = listOf("eng", UNKNOWN_LANGUAGE)),
                    onSessionInvalidated = {},
                    onCancel = {},
                    onSaved = { saved.set(true) },
                )
            }
        }

        compose.onNodeWithText("English, ${languageName(UNKNOWN_LANGUAGE)}").performClick()
        compose.onNodeWithTag("editProfileLanguageOption-eng").assertIsSelected()
        compose.onNodeWithTag("editProfileLanguageOption-$UNKNOWN_LANGUAGE").assertIsSelected()
        compose.onNodeWithTag("editProfileLanguageOption-spa").assertIsNotSelected()
        compose.onNodeWithTag("editProfileLanguageOption-$UNKNOWN_LANGUAGE").performScrollTo().performClick()
        compose.onNodeWithText("Spanish").performScrollTo().performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("editProfileLanguageOption-spa").assertIsSelected()
        compose.onNodeWithTag("editProfileLanguageOption-$UNKNOWN_LANGUAGE").assertDoesNotExist()
        pressBackFromNonActivityRoot(compose.activity)
        compose.waitUntil(5_000) {
            compose.onAllNodesWithTag("editProfileLanguageOption-spa").fetchSemanticsNodes().isEmpty()
        }
        compose.onNodeWithText("Save changes").performClick()

        compose.waitUntil(10_000) { saved.get() && apiFixture.requests.size == 1 }
        val request = apiFixture.requests.single()
        assertEquals("PUT", request.method)
        assertEquals("/api/users", request.path)
        val sentLanguages = JSONObject(request.body).getJSONArray("languages").asStringSet()
        assertEquals(setOf("eng", "spa"), sentLanguages)
        assertFalse(UNKNOWN_LANGUAGE in sentLanguages)
    }

    @Test fun profileSave503Then401KeepsEditedValuesAndInvalidatesSession() {
        val apiFixture = startFixture(expectedRequests = 2) { attempt, _ ->
            if (attempt == 1) {
                FixtureResponse(503, """{"message":"Profile could not be saved."}""")
            } else {
                FixtureResponse(401, """{"message":"Please sign in again."}""")
            }
        }
        val invalidated = AtomicBoolean(false)
        val saved = AtomicBoolean(false)

        compose.setContent {
            TrustrootsTheme {
                EditProfileScreen(
                    api = api(apiFixture),
                    session = session,
                    profile = profile(languages = listOf("eng")),
                    onSessionInvalidated = { invalidated.set(true) },
                    onCancel = {},
                    onSaved = { saved.set(true) },
                )
            }
        }

        compose.onNodeWithText("Name").performTextReplacement("Updated Fox")
        compose.onNodeWithText("Tagline").performTextReplacement("A brighter place to pause.")
        compose.onNodeWithText("Lives in").performTextReplacement("Fictional Bay")
        compose.onNodeWithText("From").performTextReplacement("Imaginary Coast")
        compose.onNodeWithText("About me").performTextReplacement("I enjoy quiet journeys.")
        compose.onNodeWithText("Save changes").performClick()

        waitForText("Profile could not be saved.")
        compose.onNodeWithText("Profile could not be saved.").assertIsDisplayed()
        assertFalse(invalidated.get())
        compose.onNodeWithText("Save changes").assertIsEnabled().performClick()
        compose.waitUntil(10_000) {
            invalidated.get() && apiFixture.requests.size == 2 &&
                runCatching { compose.onNodeWithText("Save changes").assertIsEnabled() }.isSuccess
        }
        compose.waitForIdle()
        compose.onNodeWithText("Save changes").assertIsEnabled()

        val updates = apiFixture.requests.toList()
        assertEquals(2, updates.size)
        assertTrue(updates.all { it.method == "PUT" && it.path == "/api/users" })
        val expectedFields = mapOf(
            "displayName" to "Updated Fox",
            "tagline" to "A brighter place to pause.",
            "locationLiving" to "Fictional Bay",
            "locationFrom" to "Imaginary Coast",
            "description" to "I enjoy quiet journeys.",
        )
        updates.forEach { request ->
            val body = JSONObject(request.body)
            expectedFields.forEach { (key, value) -> assertEquals(value, body.getString(key)) }
            assertEquals(setOf("eng"), body.getJSONArray("languages").asStringSet())
        }
        compose.onNodeWithText("Updated Fox").assertIsDisplayed()
        compose.onNodeWithText("A brighter place to pause.").assertIsDisplayed()
        compose.onNodeWithText("Fictional Bay").assertIsDisplayed()
        compose.onNodeWithText("Imaginary Coast").assertIsDisplayed()
        compose.onNodeWithText("I enjoy quiet journeys.").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Profile could not be saved.").fetchSemanticsNodes().isEmpty())
        assertFalse(saved.get())
    }

    private fun startFixture(
        expectedRequests: Int,
        respond: (Int, CapturedProfileRequest) -> FixtureResponse,
    ): ProfileUpdateFixture = ProfileUpdateFixture(expectedRequests, respond).also { fixture = it }

    private fun api(server: ProfileUpdateFixture) = MobileApiClient(server.baseUrl)

    private fun profile(languages: List<String>) = MemberProfile(
        "member-one",
        "quiet-fox",
        "Quiet Fox",
        "A quiet place to pause.",
        "Hello travellers.",
        null,
        languages = languages,
    )

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun JSONArray.asStringSet(): Set<String> = buildSet {
        for (index in 0 until length()) add(getString(index))
    }

    private companion object {
        const val UNKNOWN_LANGUAGE = "zzx"
    }
}

private data class CapturedProfileRequest(val method: String, val path: String, val body: String)
private data class FixtureResponse(val status: Int, val body: String)

private class ProfileUpdateFixture(
    private val expectedRequests: Int,
    private val respond: (Int, CapturedProfileRequest) -> FixtureResponse,
) : AutoCloseable {
    private val server = ServerSocket(0).apply { soTimeout = 20_000 }
    private val activeSocket = AtomicReference<Socket?>()
    private val failure = AtomicReference<Throwable?>()
    val requests = CopyOnWriteArrayList<CapturedProfileRequest>()
    val baseUrl = "http://127.0.0.1:${server.localPort}"

    private val responder = thread(isDaemon = true, name = "profile-update-fixture") {
        try {
            repeat(expectedRequests) { index ->
                val socket = try {
                    server.accept()
                } catch (error: SocketException) {
                    if (server.isClosed) return@thread else throw error
                } catch (error: SocketTimeoutException) {
                    throw AssertionError("Timed out waiting for profile update ${index + 1}", error)
                }
                activeSocket.set(socket)
                socket.soTimeout = 10_000
                socket.use {
                    val input = socket.getInputStream()
                    val requestLine = input.readAsciiLine() ?: throw EOFException("Missing HTTP request line")
                    var contentLength = 0
                    while (true) {
                        val header = input.readAsciiLine() ?: throw EOFException("Incomplete HTTP headers")
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", ignoreCase = true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    val body = input.readUtf8Body(contentLength)
                    val request = CapturedProfileRequest(
                        method = requestLine.substringBefore(' '),
                        path = requestLine.substringAfter(' ').substringBefore(' '),
                        body = body,
                    )
                    requests += request
                    val response = respond(index + 1, request)
                    val bytes = response.body.toByteArray(Charsets.UTF_8)
                    val reason = when (response.status) {
                        200 -> "OK"
                        401 -> "Unauthorized"
                        503 -> "Service Unavailable"
                        else -> "Fixture Response"
                    }
                    socket.getOutputStream().apply {
                        write(
                            "HTTP/1.1 ${response.status} $reason\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                                .toByteArray(Charsets.US_ASCII),
                        )
                        write(bytes)
                        flush()
                    }
                }
                activeSocket.set(null)
            }
        } catch (error: Throwable) {
            failure.set(error)
        } finally {
            activeSocket.getAndSet(null)?.close()
        }
    }

    override fun close() {
        server.close()
        activeSocket.getAndSet(null)?.close()
        responder.join(2_000)
        failure.get()?.let { throw AssertionError("Offline profile fixture failed", it) }
    }
}

private fun java.io.InputStream.readAsciiLine(): String? {
    val bytes = ByteArrayOutputStream()
    var previous = -1
    while (true) {
        val next = read()
        if (next == -1) return if (bytes.size() == 0) null else bytes.toString(Charsets.US_ASCII.name())
        if (previous == '\r'.code && next == '\n'.code) {
            val line = bytes.toByteArray()
            return String(line, 0, line.size - 1, Charsets.US_ASCII)
        }
        bytes.write(next)
        previous = next
    }
}

private fun java.io.InputStream.readUtf8Body(contentLength: Int): String {
    val body = ByteArray(contentLength)
    var offset = 0
    while (offset < body.size) {
        val count = read(body, offset, body.size - offset)
        if (count < 0) throw EOFException("Request body ended after $offset of $contentLength bytes")
        offset += count
    }
    return body.toString(Charsets.UTF_8)
}
