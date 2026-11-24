package org.trustroots.android.nostr

import android.app.Activity
import android.content.Intent
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.core.app.ActivityOptionsCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.zxing.client.android.Intents
import com.journeyapps.barcodescanner.ScanOptions
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.browser.BrowserNostrSession
import org.trustroots.android.ui.account.NostranslationEntry

@RunWith(AndroidJUnit4::class)
class NostranslationEntryJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun reviewsAPairingThenApprovesAndDeniesSignaturesBeforeRevokingTheClient() {
        val backend = "https://example.test"
        val username = "pair-${UUID.randomUUID()}"
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val keys = AndroidNostrKeys(context, nostrAccountScope(backend, username))
        val clientKey = ByteArray(32).apply { this[31] = 1 }
        val peer = NostrEventSigner.publicKey(clientKey)
        val connectionLink = "nostrconnect://$peer?relay=wss%3A%2F%2Frelay.trustroots.org" +
            "&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture"
        val relay = RecordingNostranslationRelay()
        val session = mutableStateOf<BrowserNostrSession?>(null)
        try {
            keys.generate()
            compose.setContent { NostranslationEntry(backend, username, session.value, true, relay) }
            val entry = compose.onNodeWithText("Nostranslation signing")
            entry.assertIsNotEnabled()
            compose.runOnIdle { session.value = BrowserNostrSession(keys) { true } }
            entry.performClick()

            val link = compose.onNode(hasSetTextAction())
            val review = compose.onNodeWithText("Review connection")
            review.assertIsNotEnabled()
            link.performTextReplacement("x".repeat(2_049))
            review.assertIsNotEnabled()
            link.performTextReplacement("not a connection link")
            review.performClick()
            compose.onNodeWithText("Enter a valid Nostranslation connection link.").assertIsDisplayed()
            link.performTextReplacement(connectionLink)
            review.performClick()
            val pair = compose.onNode(hasText("Pair with Nostranslation") and hasClickAction())
            compose.onNodeWithText("Cancel").performClick()
            review.performClick()
            pair.performClick()

            compose.runOnIdle { relay.open() }
            lateinit var transport: String
            lateinit var subscription: String
            compose.runOnIdle {
                subscription = relay.frames.first().getString(1)
                val handshake = relay.frames.last().getJSONObject(1)
                transport = handshake.getString("pubkey")
                relay.receive(JSONArray().put("OK").put(handshake.getString("id")).put(true))
            }
            val connected = compose.onNodeWithText("Nostranslation client ${peer.take(12)}")
            connected.assertIsDisplayed()

            val secret = NostrConnectEncryption.conversationKey(clientKey, NostrEventSigner.decodeHex(transport, 32))
            val timestamp = System.currentTimeMillis() / 1000
            val tags = JSONArray()
                .put(JSONArray().put("u").put("https://nostranslation-api.trustroots.org/api/reviews"))
                .put(JSONArray().put("method").put("POST"))
                .put(JSONArray().put("payload").put("a".repeat(64)))
            val event = JSONObject().put("kind", 27235).put("created_at", timestamp)
                .put("content", "").put("tags", tags)
            fun reviewFrame(id: String): JSONArray {
                val rpc = JSONObject().put("id", id).put("method", "sign_event")
                    .put("params", JSONArray().put(event.toString()))
                val request = NostrEventSigner.sign(
                    JSONObject().put("kind", 24133).put("created_at", timestamp)
                        .put("tags", JSONArray().put(JSONArray().put("p").put(transport)))
                        .put("content", NostrConnectEncryption.encrypt(rpc.toString(), secret)),
                    clientKey,
                )
                return JSONArray().put("EVENT").put(subscription).put(request)
            }

            compose.runOnIdle { relay.receive(reviewFrame("approved-from-dialog")) }
            compose.onNodeWithText("Authorise a translation review").assertIsDisplayed()
            compose.onNodeWithText("Approve signature").performClick()
            compose.runOnIdle {
                val reply = relay.frames.last().getJSONObject(1)
                val approved = JSONObject(NostrConnectEncryption.decrypt(reply.getString("content"), secret))
                val signed = JSONObject(approved.getString("result"))
                val localPublicKey = requireNotNull(keys.browserPublicKey(keys.revision()))
                assertEquals("approved-from-dialog", approved.getString("id"))
                assertTrue(NostrEventSigner.verifies(signed, localPublicKey))
            }

            compose.runOnIdle { relay.receive(reviewFrame("denied-from-dialog")) }
            compose.onNodeWithText("Authorise a translation review").assertIsDisplayed()
            compose.onNodeWithText("Deny").performClick()
            compose.runOnIdle {
                val reply = relay.frames.last().getJSONObject(1)
                val denied = JSONObject(NostrConnectEncryption.decrypt(reply.getString("content"), secret))
                assertEquals("denied-from-dialog", denied.getString("id"))
                assertEquals("Authorisation denied.", denied.getString("error"))
            }
            compose.runOnIdle { relay.fail() }
            compose.onNodeWithText("The relay connection failed. Close and reopen this screen to retry.")
                .assertIsDisplayed()
            compose.onNodeWithText("Revoke client").performClick()
            connected.assertDoesNotExist()
            compose.runOnIdle { assertTrue(relay.cancelled) }
            compose.onNodeWithText("Done").performClick()
            link.assertDoesNotExist()
        } finally {
            keys.remove()
        }
    }

    @Test fun reviewsAScannedLinkAndExplainsWhenTheLocalKeyIsMissing() {
        val backend = "https://example.test"
        val username = "scan-${UUID.randomUUID()}"
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val keys = AndroidNostrKeys(context, nostrAccountScope(backend, username))
        val peer = NostrEventSigner.publicKey(ByteArray(32).apply { this[31] = 1 })
        val connectionLink = "nostrconnect://$peer?relay=wss%3A%2F%2Frelay.trustroots.org" +
            "&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture"
        val scanner = ScanResultRegistry()
        val relay = RecordingNostranslationRelay()
        val owner = object : ActivityResultRegistryOwner {
            override val activityResultRegistry = scanner
        }
        val session = BrowserNostrSession(keys) { true }
        try {
            compose.setContent {
                CompositionLocalProvider(LocalActivityResultRegistryOwner provides owner) {
                    NostranslationEntry(backend, username, session, true, relay)
                }
            }
            compose.onNodeWithText("Nostranslation signing").performClick()
            val scan = compose.onNodeWithText("Scan Nostranslation QR code")
            val pair = compose.onNode(hasText("Pair with Nostranslation") and hasClickAction())
            val actionFailed = compose.onNodeWithText(
                "This action could not be completed. Check your local Nostr key and try again.",
            )
            compose.runOnIdle { scanner.available = false }
            scan.performClick()
            actionFailed.assertIsDisplayed()
            compose.runOnIdle { scanner.available = true }

            scan.performClick()
            compose.runOnIdle { scanner.finish(null) }
            pair.assertDoesNotExist()
            scan.performClick()
            compose.runOnIdle { scanner.finish(connectionLink) }
            pair.assertIsDisplayed()
            pair.performClick()
            actionFailed.assertIsDisplayed()
        } finally {
            keys.remove()
        }
    }

    private class ScanResultRegistry : ActivityResultRegistry() {
        private var pendingCode: Int? = null
        var available = true

        override fun <I, O> onLaunch(
            requestCode: Int,
            contract: ActivityResultContract<I, O>,
            input: I,
            options: ActivityOptionsCompat?,
        ) {
            assertTrue(input is ScanOptions)
            check(available) { "No scanner available in the fixture" }
            pendingCode = requestCode
        }

        fun finish(link: String?) {
            val code = requireNotNull(pendingCode)
            pendingCode = null
            val result = if (link == null) Activity.RESULT_CANCELED else Activity.RESULT_OK
            val data = link?.let { Intent().putExtra(Intents.Scan.RESULT, it) }
            check(dispatchResult(code, result, data))
        }
    }
}
