package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.editprofile.EditProfileScreen
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ProfileEditingJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val server = ServerSocket(0)

    @After fun closeServer() = server.close()

    @Test fun profileFormFieldsHaveConsistentVerticalSpacing() {
        val filledContainerColour = AtomicReference(0)
        compose.setContent {
            TrustrootsTheme {
                val surfaceContainerHighest = MaterialTheme.colorScheme.surfaceContainerHighest.toArgb()
                SideEffect {
                    filledContainerColour.set(surfaceContainerHighest)
                }
                EditProfileScreen(
                    api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                    profile = MemberProfile("member-one", "quiet-fox", "Quiet Fox", null, null, null, languages = emptyList()),
                    onSessionInvalidated = {},
                    onCancel = {},
                    onSaved = {},
                )
            }
        }

        val nameBounds = compose.onNodeWithText("Name").fetchSemanticsNode().boundsInRoot
        val taglineBounds = compose.onNodeWithText("Tagline").fetchSemanticsNode().boundsInRoot
        val minimumGap = with(compose.density) { 12.dp.toPx() }
        val sampleX = with(compose.density) { 8.dp.toPx().toInt() }
        val sampleY = with(compose.density) { 24.dp.toPx().toInt() }
        val sampledContainerColour = compose.onNodeWithText("Name")
            .captureToImage()
            .toPixelMap()[sampleX, sampleY]

        assertEquals("Filled fields should use the Material surface container colour", filledContainerColour.get(), sampledContainerColour.toArgb())
        assertTrue("Adjacent profile fields should have a consistent gap", taglineBounds.top - nameBounds.bottom >= minimumGap)
    }

    @Test fun profileFormFieldsUseDarkFilledSurfaceAndKeepVerticalSpacing() {
        val activity = compose.activity
        val darkConfiguration = Configuration(activity.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or Configuration.UI_MODE_NIGHT_YES
        }
        val darkContext = activity.createConfigurationContext(darkConfiguration)
        val filledContainerColour = AtomicReference(0)
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides darkContext,
                LocalConfiguration provides darkContext.resources.configuration,
            ) {
                TrustrootsTheme {
                    val surfaceContainerHighest = MaterialTheme.colorScheme.surfaceContainerHighest.toArgb()
                    SideEffect { filledContainerColour.set(surfaceContainerHighest) }
                    EditProfileScreen(
                        api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                        session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                        profile = MemberProfile("member-one", "quiet-fox", "Quiet Fox", null, null, null, languages = emptyList()),
                        onSessionInvalidated = {},
                        onCancel = {},
                        onSaved = {},
                    )
                }
            }
        }

        val nameBounds = compose.onNodeWithText("Name").fetchSemanticsNode().boundsInRoot
        val taglineBounds = compose.onNodeWithText("Tagline").fetchSemanticsNode().boundsInRoot
        val minimumGap = with(compose.density) { 12.dp.toPx() }
        val sampleX = with(compose.density) { 8.dp.toPx().toInt() }
        val sampleY = with(compose.density) { 24.dp.toPx().toInt() }
        val sampledContainerColour = compose.onNodeWithText("Name")
            .captureToImage()
            .toPixelMap()[sampleX, sampleY]

        assertEquals("Dark filled fields should use the dark Material surface container colour", filledContainerColour.get(), sampledContainerColour.toArgb())
        assertTrue("Adjacent dark profile fields should retain a consistent gap", taglineBounds.top - nameBounds.bottom >= minimumGap)
    }

    @Test fun editsOwnProfileAndShowsSavedFields() {
        val savedBody = AtomicReference("")
        val profileLoads = AtomicInteger()
        val returnedToMap = AtomicBoolean(false)
        thread(isDaemon = true) {
            repeat(10) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", true)) {
                            contentLength = header.substringAfter(':').trim().toInt()
                        }
                    }
                    if (request.startsWith("GET /api/users/quiet-fox ")) profileLoads.incrementAndGet()
                    if (request.startsWith("PUT ")) {
                        val body = CharArray(contentLength)
                        var offset = 0
                        while (offset < body.size) {
                            val count = input.read(body, offset, body.size - offset)
                            if (count < 0) break
                            offset += count
                        }
                        savedBody.set(body.concatToString(0, offset))
                    }
                    val payload = when {
                        request.startsWith("PUT ") -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"New line","description":"Hello travellers","languages":["eng"]}"""
                        request.contains("/api/users/quiet-fox") -> """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"Old line","description":"Hello travellers","languages":["eng"]}"""
                        else -> "[]"
                    }
                    val bytes = payload.toByteArray()
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                }
            }
        }
        compose.setContent {
            NativeTestAppFrame(Destination.Menu) {
                MemberProfileScreen(
                    MobileApiClient("http://127.0.0.1:${server.localPort}"),
                    MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                    "quiet-fox", onSessionInvalidated = {}, onBack = { returnedToMap.set(true) },
                )
            }
        }
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Old line").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals("The profile route should load its canonical profile once", 1, profileLoads.get())
        compose.onNodeWithText("Edit your profile").performClick()
        compose.onNodeWithText("Tagline").performTextReplacement("New line")
        assertEquals("Ordinary edit navigation should use the retained snapshot", 1, profileLoads.get())
        compose.onNodeWithText("New line").assertIsDisplayed()
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { savedBody.get().isNotBlank() }
        assertTrue(savedBody.get().contains("\"tagline\":\"New line\""))
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("New line").fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals("The saved profile completion should update the retained parent without a duplicate profile request", 1, profileLoads.get())
        compose.onNodeWithText("New line").assertIsDisplayed()
        compose.onNodeWithText("Experiences").assertIsDisplayed()
        compose.onNodeWithText("About").assertIsDisplayed()
        compose.onNodeWithText("About").performClick()
        compose.onNodeWithText("Hello travellers").performScrollTo().assertIsDisplayed()
        captureUsabilityScreenshot(compose, "android_profile")
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        assertTrue(returnedToMap.get())
    }

    @Test fun keepsProfileEditsAfterSaveFailureAndAllowsRetry() {
        val requestCount = AtomicInteger()
        val savedTagline = AtomicReference("")
        val responder = thread(isDaemon = true) {
            repeat(2) {
                val connection = runCatching { server.accept() }.getOrNull() ?: return@thread
                connection.use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    input.readLine()
                    var contentLength = 0
                    while (true) {
                        val header = input.readLine() ?: break
                        if (header.isEmpty()) break
                        if (header.startsWith("Content-Length:", true)) {
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
                    val attempt = requestCount.incrementAndGet()
                    val response = if (attempt == 1) {
                        """{"message":"Profile could not be saved."}"""
                    } else {
                        val tagline = org.json.JSONObject(body.concatToString(0, offset)).getString("tagline")
                        savedTagline.set(tagline)
                        """{"_id":"member-one","username":"quiet-fox","displayName":"Quiet Fox","tagline":"$tagline","description":"Hello travellers","languages":["eng"]}"""
                    }
                    val bytes = response.toByteArray()
                    val status = if (attempt == 1) "HTTP/1.1 503 Service Unavailable" else "HTTP/1.1 200 OK"
                    socket.getOutputStream().write(
                        "$status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(),
                    )
                    socket.getOutputStream().write(bytes)
                    socket.getOutputStream().flush()
                }
            }
        }
        val saved = AtomicBoolean(false)
        compose.setContent {
            EditProfileScreen(
                api = MobileApiClient("http://127.0.0.1:${server.localPort}"),
                session = MemberSession("connect.sid=test", MobileMember("quiet-fox", "Quiet Fox")),
                profile = MemberProfile("member-one", "quiet-fox", "Quiet Fox", "Old line", "Hello travellers", null, languages = listOf("eng")),
                onSessionInvalidated = {},
                onCancel = {},
                onSaved = { saved.set(true) },
            )
        }
        compose.onNodeWithText("Tagline").performTextReplacement("New line")
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Profile could not be saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("New line").assertIsDisplayed()
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) { saved.get() }
        assertTrue(savedTagline.get() == "New line")
        assertTrue(compose.onAllNodesWithText("Profile could not be saved.").fetchSemanticsNodes().isEmpty())
        responder.join(1_000)
    }
}
