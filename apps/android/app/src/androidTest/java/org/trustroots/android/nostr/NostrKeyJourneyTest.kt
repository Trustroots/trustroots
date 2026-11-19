package org.trustroots.android.nostr

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.account.NostrKeyEntry

@RunWith(AndroidJUnit4::class)
class NostrKeyJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun generateAndRemoveKeepsTheProfileKey(): Unit = ServerSocket(0).use { server ->
        val username = "test-key-member"
        val backend = "http://127.0.0.1:${server.localPort}"
        val profile = "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d"
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val keys = AndroidNostrKeys(context, nostrAccountScope(backend, username))
        keys.remove()
        val responder = thread(isDaemon = true) {
            runCatching { server.accept() }.getOrNull()?.use { socket ->
                val reader = socket.getInputStream().bufferedReader()
                while (true) {
                    if (reader.readLine().isNullOrEmpty()) break
                }
                val body = """{"profile":{"username":"$username","nostrNpub":"$profile"}}""".encodeToByteArray()
                socket.getOutputStream().apply {
                    write("HTTP/1.1 200 OK\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".encodeToByteArray())
                    write(body)
                }
            }
        }
        try {
            val api = MobileApiClient(backend)
            val session = MemberSession("", MobileMember(username, "Test Member"), accessToken = "fixture")
            compose.setContent { NostrKeyEntry(api, session, enabled = true) }
            compose.onNodeWithText("Nostr key").performClick()
            awaitText("Generate new key")
            compose.onNodeWithText("Generate new key").performScrollTo().performClick()
            awaitText("Copy public key")
            awaitText(profile)
            compose.onNodeWithText("Remove local key").performScrollTo().performClick()
            compose.onNodeWithText("Cancel").performClick()
            compose.onNodeWithText("Copy public key").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Remove local key").performScrollTo().performClick()
            compose.onNode(hasText("Remove local key") and hasClickAction()).performClick()
            awaitText("Generate new key")
            compose.onNodeWithText(profile).performScrollTo().assertIsDisplayed()
            Unit
        } finally {
            keys.remove()
            server.close()
            responder.join(1_000)
        }
    }

    private fun awaitText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
