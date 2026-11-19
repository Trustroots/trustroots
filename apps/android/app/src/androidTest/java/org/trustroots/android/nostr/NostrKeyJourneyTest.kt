package org.trustroots.android.nostr

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.account.NostrKeyEntry

@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class NostrKeyJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun replaceAndUnlinkAreSeparateFromLocalRemoval(): Unit = ServerSocket(0).use { server ->
        val username = "test-key-member"
        val backend = "http://127.0.0.1:${server.localPort}"
        val profile = "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d"
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val keys = AndroidNostrKeys(context, nostrAccountScope(backend, username))
        keys.remove()
        val responder = thread(isDaemon = true) {
            var linkedKey: String? = profile
            val challenge = JSONObject().put("kind", 27235).put("created_at", System.currentTimeMillis() / 1000)
                .put("content", "").put("tags", JSONArray()
                    .put(JSONArray().put("u").put("$backend/api/users"))
                    .put(JSONArray().put("method").put("PUT"))
                    .put(JSONArray().put("challenge").put("a".repeat(64))))
            repeat(4) {
                runCatching { server.accept() }.getOrNull()?.use { socket ->
                    val reader = socket.getInputStream().bufferedReader()
                    val request = reader.readLine().orEmpty()
                    var length = 0
                    while (true) {
                        val line = reader.readLine()
                        if (line.isNullOrEmpty()) break
                        if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                    }
                    val input = CharArray(length)
                    var offset = 0
                    while (offset < length) {
                        val count = reader.read(input, offset, length - offset)
                        if (count < 0) break
                        offset += count
                    }
                    val current = JSONObject().put("username", username)
                    val response = when {
                        request.startsWith("POST /api/mobile/v0/profile/nostr/challenge ") ->
                            JSONObject().put("event", challenge)
                        request.startsWith("PUT /api/mobile/v0/profile ") -> {
                            val update = JSONObject(input.concatToString())
                            linkedKey = update.getString("nostrNpub").ifEmpty { null }
                            if (linkedKey != null) {
                                val proof = update.getJSONObject("nostrProof")
                                check(proof.getString("sig").length == 128)
                                check(proof.getJSONArray("tags").toString() == challenge.getJSONArray("tags").toString())
                            }
                            current.put("nostrNpub", linkedKey ?: JSONObject.NULL)
                        }
                        else -> JSONObject().put("profile", current.put("nostrNpub", linkedKey))
                    }
                    val body = response.toString().encodeToByteArray()
                    socket.getOutputStream().apply {
                        write("HTTP/1.1 200 OK\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".encodeToByteArray())
                        write(body)
                    }
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
            val replacement = compose.onNode(hasText("Replace profile key") and hasClickAction())
            replacement.performScrollTo().performClick()
            compose.onNodeWithText("Cancel").performClick()
            compose.onNodeWithText(profile).performScrollTo().assertIsDisplayed()
            replacement.performScrollTo().performClick()
            replacement.performClick()
            compose.waitUntilDoesNotExist(hasText(profile), timeoutMillis = 10_000)
            compose.onNodeWithText("Remove local key").performScrollTo().performClick()
            compose.onNodeWithText("Cancel").performClick()
            compose.onNodeWithText("Copy public key").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Remove local key").performScrollTo().performClick()
            compose.onNode(hasText("Remove local key") and hasClickAction()).performClick()
            awaitText("Generate new key")
            val unlink = compose.onNode(hasText("Unlink profile key") and hasClickAction())
            unlink.performScrollTo().performClick()
            unlink.performClick()
            awaitText("No linked public key.")
        } finally {
            keys.remove()
            server.close()
            responder.join(1_000)
        }
    }

    private fun awaitText(text: String) {
        compose.waitUntilAtLeastOneExists(hasText(text), timeoutMillis = 10_000)
    }
}
