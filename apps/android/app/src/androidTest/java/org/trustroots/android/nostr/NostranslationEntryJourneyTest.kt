package org.trustroots.android.nostr

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.core.app.ActivityOptionsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.zxing.client.android.Intents
import com.journeyapps.barcodescanner.ScanOptions
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.browser.BrowserNostrSession
import org.trustroots.android.notifications.NostranslationAlerts
import org.trustroots.android.testing.pressBackFromNonActivityRoot
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.account.NostranslationDialog
import org.trustroots.android.ui.account.NostranslationEntry

@RunWith(AndroidJUnit4::class)
class NostranslationEntryJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun reviewsAPairingThenApprovesAndDeniesSignaturesBeforeRevokingTheClient() {
        val backend = "https://example.test"
        val username = "pair-${UUID.randomUUID()}"
        val api = MobileApiClient(backend)
        val memberSession = MemberSession("", MobileMember(username, "Fixture Member"))
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val account = nostrAccountScope(backend, username)
        val keys = AndroidNostrKeys(context, account)
        val keyPreferences = context.getSharedPreferences("nostr-identities", Context.MODE_PRIVATE)
        val clientKey = ByteArray(32).apply { this[31] = 1 }
        val peer = NostrEventSigner.publicKey(clientKey)
        val connectionLink = "nostrconnect://$peer?relay=wss%3A%2F%2Frelay.trustroots.org" +
            "&url=https%3A%2F%2Fteam.trustroots.org%2Fnostranslation&perms=sign_event%3A27235&secret=fixture"
        val relay = RecordingNostranslationRelay()
        val session = mutableStateOf<BrowserNostrSession?>(null)
        var now = 1_800_000_000L
        try {
            keys.generate()
            compose.setContent { NostranslationEntry(api, memberSession, session.value, true, relay) { now } }
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
            val timestamp = now
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
            compose.runOnIdle { relay.receive(reviewFrame("dismissed-with-back")) }
            compose.onNodeWithText("Authorise a translation review").assertIsDisplayed()
            pressBackFromNonActivityRoot(compose.activity, dialogOnly = true)
            compose.runOnIdle {
                val reply = relay.frames.last().getJSONObject(1)
                val dismissed = JSONObject(NostrConnectEncryption.decrypt(reply.getString("content"), secret))
                assertEquals("dismissed-with-back", dismissed.getString("id"))
                assertEquals("Authorisation denied.", dismissed.getString("error"))
            }

            val savedKey = requireNotNull(keyPreferences.getString(account.storageAccount, null))
            val beforeUnreadableKey = relay.frames.size
            compose.runOnIdle {
                check(keyPreferences.edit().putString(account.storageAccount, "AA==").commit())
                relay.receive(reviewFrame("received-with-unreadable-key"))
            }
            compose.onNodeWithText("The relay connection failed. Close and reopen this screen to retry.").assertIsDisplayed()
            compose.onNodeWithText("Authorise a translation review").assertDoesNotExist()
            compose.runOnIdle {
                assertEquals(beforeUnreadableKey, relay.frames.size)
                check(keyPreferences.edit().putString(account.storageAccount, savedKey).commit())
            }

            val error = compose.onNodeWithText(
                "This action could not be completed. Check your local Nostr key and try again.",
            )
            val actions: List<() -> Unit> = listOf(
                { compose.onNodeWithText("Approve signature").performClick() },
                { compose.onNodeWithText("Deny").performClick() },
                { pressBackFromNonActivityRoot(compose.activity, dialogOnly = true) },
            )
            for ((index, act) in actions.withIndex()) {
                val frames = relay.frames.size
                compose.runOnIdle { relay.receive(reviewFrame("unreadable-key-$index")) }
                compose.onNodeWithText("Authorise a translation review").assertIsDisplayed()
                compose.runOnIdle { check(keyPreferences.edit().putString(account.storageAccount, "AA==").commit()) }
                act()
                error.assertIsDisplayed()
                compose.runOnIdle {
                    assertEquals(frames, relay.frames.size)
                    check(keyPreferences.edit().putString(account.storageAccount, savedKey).commit())
                }
            }

            compose.runOnIdle { relay.receive(reviewFrame("expires-in-dialog")) }
            compose.onNodeWithText("Approve signature").assertIsDisplayed()
            compose.runOnIdle { now = timestamp + 61 }
            compose.mainClock.advanceTimeBy(1_050)
            compose.onNodeWithText("This request expired. Retry in Nostranslation.").assertIsDisplayed()
            compose.onNodeWithText("Approve signature").assertDoesNotExist()
            compose.onNodeWithText("Done").performClick()
            compose.runOnIdle {
                val reply = relay.frames.last().getJSONObject(1)
                val expired = JSONObject(NostrConnectEncryption.decrypt(reply.getString("content"), secret))
                assertEquals("expires-in-dialog", expired.getString("id"))
                assertEquals("Authorisation denied.", expired.getString("error"))
                relay.fail()
            }
            compose.onNodeWithText("The relay connection failed. Close and reopen this screen to retry.")
                .assertIsDisplayed()
            val revoke = compose.onNodeWithText("Revoke client")
            compose.runOnIdle { check(keyPreferences.edit().putString(account.storageAccount, "AA==").commit()) }
            revoke.performClick()
            error.assertIsDisplayed()
            connected.assertIsDisplayed()
            compose.runOnIdle { check(keyPreferences.edit().putString(account.storageAccount, savedKey).commit()) }
            revoke.performClick()
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
        val api = MobileApiClient(backend)
        val memberSession = MemberSession("", MobileMember(username, "Fixture Member"))
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
        val lifecycleOwner = object : LifecycleOwner {
            override val lifecycle = LifecycleRegistry(this)
        }
        val session = BrowserNostrSession(keys) { true }
        try {
            compose.runOnIdle { lifecycleOwner.lifecycle.currentState = Lifecycle.State.RESUMED }
            compose.setContent {
                CompositionLocalProvider(
                    LocalActivityResultRegistryOwner provides owner,
                    LocalLifecycleOwner provides lifecycleOwner,
                ) {
                    NostranslationEntry(api, memberSession, session, true, relay)
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
            compose.runOnIdle { lifecycleOwner.lifecycle.currentState = Lifecycle.State.CREATED }
            scan.assertIsDisplayed()
            compose.runOnIdle {
                lifecycleOwner.lifecycle.currentState = Lifecycle.State.RESUMED
                scanner.finish(null)
            }
            pair.assertDoesNotExist()
            scan.performClick()
            compose.runOnIdle { scanner.finish(connectionLink) }
            pair.assertIsDisplayed()
            pair.performClick()
            actionFailed.assertIsDisplayed()
            compose.runOnIdle { lifecycleOwner.lifecycle.currentState = Lifecycle.State.CREATED }
            scan.assertDoesNotExist()
        } finally {
            keys.remove()
        }
    }

    @Test fun invalidStoredPairingCanBeRetriedAndDisablingTheEntryHidesItsDialog() {
        val backend = "https://example.test"
        val username = "bad-pairing-${UUID.randomUUID()}"
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val keys = AndroidNostrKeys(context, nostrAccountScope(backend, username))
        val enabled = mutableStateOf(true)
        try {
            keys.generate()
            val revision = keys.revision()
            keys.savePairings(revision, JSONArray().put(JSONObject()))
            val session = BrowserNostrSession(keys) { true }
            val relay = RecordingNostranslationRelay()
            val api = MobileApiClient(backend)
            val member = MemberSession("", MobileMember(username, "Fixture Member"))
            compose.setContent { NostranslationEntry(api, member, session, enabled.value, relay) }

            val entry = compose.onNodeWithText("Nostranslation signing")
            val done = compose.onNodeWithText("Done")
            val actionFailed = compose.onNodeWithText(
                "This action could not be completed. Check your local Nostr key and try again.",
            )
            entry.performClick()
            actionFailed.assertIsDisplayed()
            done.performClick()

            keys.savePairings(revision, JSONArray())
            entry.performClick()
            done.assertIsDisplayed()
            actionFailed.assertDoesNotExist()
            compose.runOnIdle { enabled.value = false }
            done.assertDoesNotExist()
            entry.assertIsNotEnabled()
            assertEquals(0, relay.connectionsCreated)
        } finally {
            keys.remove()
        }
    }

    @Test fun openingAnAlertShowsItsRetryHintAndReflectsDisablingAlertsImmediately() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val api = MobileApiClient("https://example.test")
        val session = MemberSession("", MobileMember("alert-${UUID.randomUUID()}", "Fixture Member"))
        val account = nostrAccountScope(api.backendURL, session.member.username)
        val preferences = context.getSharedPreferences("nostranslation-alerts", Context.MODE_PRIVATE)
        val previousStatus = NostranslationAlerts.status.value
        val keys = AndroidNostrKeys(context, account)
        val peer = NostrEventSigner.publicKey(ByteArray(32).apply { this[31] = 1 })
        val open = mutableStateOf(true)

        try {
            keys.generate()
            val signer = requireNotNull(keys.browserPublicKey(keys.revision()))
            keys.savePairings(keys.revision(), JSONArray().put(JSONObject().put("peer", peer)
                .put("transport", "0".repeat(63) + "2").put("signer", signer)))
            preferences.edit().putBoolean(account.storageAccount, true).commit()
            NostranslationAlerts.status.value = null
            val browserSession = BrowserNostrSession(keys) { true }
            val relay = RecordingNostranslationRelay()
            compose.setContent {
                if (open.value) {
                    NostranslationDialog(api, session, browserSession, openedFromAlert = true, sockets = relay) {
                        open.value = false
                    }
                }
            }

            val retryHint = compose.onNodeWithText("If the request has expired, retry in Nostranslation.")
            retryHint.performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Disable review alerts").performScrollTo().performClick()
            compose.onNodeWithText("Enable review alerts").performScrollTo().assertIsDisplayed()
            assertFalse(NostranslationAlerts.isEnabled(context, api.backendURL, session))
            compose.onNodeWithText("Done").performClick()
            retryHint.assertDoesNotExist()
        } finally {
            preferences.edit().remove(account.storageAccount).commit()
            NostranslationAlerts.status.value = previousStatus
            keys.remove()
        }
    }

    @Test fun requestsNotificationPermissionBeforeLoadingTheReviewAlertKey() {
        assumeTrue(Build.VERSION.SDK_INT >= 33)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val member = MobileMember("alert-permission-${UUID.randomUUID()}", "Fixture Member")
        val session = MemberSession("", member, "fixture-review-access")
        val failed = "Review alerts could not be enabled. Check notification settings and try again."
        LocalTransportFixture { request ->
            assertEquals("GET", request.method)
            assertEquals("/api/mobile/v0/nostranslation/alerts", request.path)
            assertEquals("Bearer fixture-review-access", request.authorization)
            LocalTransportFixture.Response("{}")
        }.use { fixture ->
            val api = MobileApiClient(fixture.baseURL)
            val account = nostrAccountScope(api.backendURL, member.username)
            val keys = AndroidNostrKeys(context, account)
            val previousStatus = NostranslationAlerts.status.value
            var granted = false
            var permissionAlreadyGranted = false
            var permissionRequests = 0
            val owner = object : ActivityResultRegistryOwner {
                override val activityResultRegistry = object : ActivityResultRegistry() {
                    override fun <I, O> onLaunch(
                        requestCode: Int,
                        contract: ActivityResultContract<I, O>,
                        input: I,
                        options: ActivityOptionsCompat?,
                    ) {
                        assertEquals(Manifest.permission.POST_NOTIFICATIONS, input)
                        permissionRequests += 1
                        dispatchResult(requestCode, granted)
                    }
                }
            }
            try {
                keys.generate()
                val revision = keys.revision()
                val peer = NostrEventSigner.publicKey(ByteArray(32).apply { this[31] = 1 })
                keys.savePairings(revision, JSONArray().put(JSONObject().put("peer", peer)
                    .put("transport", "0".repeat(63) + "2").put("signer", requireNotNull(keys.browserPublicKey(revision)))))
                NostranslationAlerts.status.value = null
                val browser = BrowserNostrSession(keys) { true }
                val relay = RecordingNostranslationRelay()
                compose.setContent {
                    val activityContext = LocalContext.current
                    val permissionContext = remember(activityContext) {
                        object : ContextWrapper(activityContext) {
                            override fun checkSelfPermission(permission: String): Int {
                                if (permission != Manifest.permission.POST_NOTIFICATIONS) return super.checkSelfPermission(permission)
                                return if (permissionAlreadyGranted) PackageManager.PERMISSION_GRANTED else PackageManager.PERMISSION_DENIED
                            }
                        }
                    }
                    CompositionLocalProvider(
                        LocalContext provides permissionContext,
                        LocalActivityResultRegistryOwner provides owner,
                    ) {
                        NostranslationDialog(api, session, browser, sockets = relay) {}
                    }
                }

                val enable = compose.onNodeWithText("Enable review alerts")
                enable.performScrollTo().performClick()
                compose.waitUntil(10_000) { compose.onAllNodesWithText(failed).fetchSemanticsNodes().isNotEmpty() }
                assertTrue(fixture.requests.isEmpty())

                compose.runOnIdle {
                    granted = true
                    NostranslationAlerts.status.value = null
                }
                enable.performScrollTo().performClick()
                compose.waitUntil(15_000) {
                    fixture.requests.isNotEmpty() && compose.onAllNodesWithText(failed).fetchSemanticsNodes().isNotEmpty()
                }
                assertEquals(1, fixture.requests.size)
                compose.runOnIdle {
                    assertEquals(2, permissionRequests)
                    permissionAlreadyGranted = true
                    NostranslationAlerts.status.value = null
                }
                enable.performScrollTo().performClick()
                compose.waitUntil(15_000) {
                    fixture.requests.size == 2 && compose.onAllNodesWithText(failed).fetchSemanticsNodes().isNotEmpty()
                }
                compose.runOnIdle { assertEquals(2, permissionRequests) }
                assertFalse(NostranslationAlerts.isEnabled(context, api.backendURL, session))
            } finally {
                NostranslationAlerts.status.value = previousStatus
                keys.remove()
            }
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
