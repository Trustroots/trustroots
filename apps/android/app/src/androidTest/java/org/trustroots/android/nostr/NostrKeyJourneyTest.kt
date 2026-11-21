package org.trustroots.android.nostr

import android.app.KeyguardManager
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.account.NostrKeyEntry

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
            compose.waitUntil(10_000) { compose.onAllNodesWithText(profile).fetchSemanticsNodes().isEmpty() }
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

    @Test fun importsAndCopiesALocalKeyAndRetriesRefusedProfileLinking() {
        val username = "test-import-member"
        val publicKey = "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d"
        val writes = AtomicInteger()
        val backendURL = AtomicReference<String>()
        LocalTransportFixture { request ->
            val member = JSONObject().put("username", username).put("nostrNpub", JSONObject.NULL)
            when (request.method to request.path) {
                "GET" to "/api/mobile/v0/profiles/$username" ->
                    LocalTransportFixture.Response(JSONObject().put("profile", member).toString())
                "POST" to "/api/mobile/v0/profile/nostr/challenge" -> {
                    val challenge = JSONObject().put("kind", 27235).put("created_at", System.currentTimeMillis() / 1000)
                        .put("content", "").put("tags", JSONArray()
                            .put(JSONArray().put("u").put("${backendURL.get()}/api/users"))
                            .put(JSONArray().put("method").put("PUT"))
                            .put(JSONArray().put("challenge").put("a".repeat(64))))
                    LocalTransportFixture.Response(JSONObject().put("event", challenge).toString())
                }
                "PUT" to "/api/mobile/v0/profile" -> when (writes.incrementAndGet()) {
                    1 -> LocalTransportFixture.Response("{}", status = 403)
                    2 -> LocalTransportFixture.Response("{}", status = 503)
                    else -> LocalTransportFixture.Response(member.put("nostrNpub", publicKey).toString())
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }.use { fixture ->
            val backend = fixture.baseURL
            backendURL.set(backend)
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val keys = AndroidNostrKeys(context, nostrAccountScope(backend, username))
            try {
                val api = MobileApiClient(backend)
                val session = MemberSession("", MobileMember(username, "Test Member"), accessToken = "fixture")
                compose.setContent { NostrKeyEntry(api, session, enabled = true) }
                compose.onNodeWithText("Nostr key").performClick()
                awaitText("Import private key")
                val field = compose.onNode(hasSetTextAction())
                val importButton = compose.onNodeWithText("Import private key")
                field.performTextReplacement("x".repeat(129))
                importButton.assertIsNotEnabled()
                field.performTextReplacement("not-a-private-key")
                importButton.performScrollTo().performClick()
                awaitText("Enter a valid nsec or 64-character private key.")
                field.performTextReplacement("0".repeat(63) + "1")
                importButton.performScrollTo().performClick()
                awaitText("Copy public key")
                compose.onNodeWithText("Copy public key").performScrollTo().performClick()
                compose.runOnIdle {
                    val clipboard = context.getSystemService(ClipboardManager::class.java)
                    assertEquals(publicKey, clipboard.primaryClip?.getItemAt(0)?.text?.toString())
                }
                if (!context.getSystemService(KeyguardManager::class.java).isDeviceSecure) {
                    compose.onNodeWithText("Back up private key").performScrollTo().performClick()
                    awaitText("Set up a device screen lock to back up your Nostr key.")
                }
                val link = compose.onNodeWithText("Link local key to profile")
                for (message in listOf(
                    "The profile update was refused. This public key may already be linked to another member.",
                    "The profile key could not be updated. Please try again.",
                )) {
                    link.performScrollTo().performClick()
                    awaitText(message)
                }
                link.performScrollTo().performClick()
                awaitText("Unlink profile key")
            } finally {
                keys.remove()
            }
        }
    }

    @Test fun showsUnavailableProfileAndLocalKeyErrors() {
        val username = "test-unavailable-key-member"
        LocalTransportFixture { LocalTransportFixture.Response("{}", status = 503) }.use { fixture ->
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            val scope = nostrAccountScope(fixture.baseURL, username)
            val keys = AndroidNostrKeys(context, scope)
            val preferences = context.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
            check(preferences.edit().putString(scope.storageAccount, "AA==").commit())
            try {
                val api = MobileApiClient(fixture.baseURL)
                val session = MemberSession("", MobileMember(username, "Test Member"), accessToken = "fixture")
                compose.setContent { NostrKeyEntry(api, session, enabled = true) }
                compose.onNodeWithText("Nostr key").performClick()
                awaitText("Profile key unavailable.")
                awaitText("The local Nostr key could not be accessed.")
                compose.onNodeWithText("Back up private key").assertDoesNotExist()
            } finally {
                keys.remove()
            }
        }
    }

    private fun awaitText(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
