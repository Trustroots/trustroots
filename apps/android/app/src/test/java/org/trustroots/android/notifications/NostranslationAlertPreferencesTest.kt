package org.trustroots.android.notifications

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Looper
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.nostr.nostrAccountScope

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class NostranslationAlertPreferencesTest {
    private val context = RuntimeEnvironment.getApplication()
    private val session = MemberSession("", MobileMember("quiet-fox", "Quiet Fox"), "fixture-access")
    private val preferences = context.getSharedPreferences("nostranslation-alerts", Context.MODE_PRIVATE)

    @Test fun disablesOnlyTheCurrentAccountAndRetriesOnlyFailedRemovals() {
        MockWebServer().use { server ->
            val rejectRemoval = AtomicBoolean(true)
            server.dispatcher = object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    val transport = JSONObject(requireNotNull(request.body).utf8()).getString("transport")
                    return MockResponse(code = if (transport == "retry" && rejectRemoval.get()) 503 else 204)
                }
            }
            server.start()
            val api = MobileApiClient(server.url("/").toString())
            val ownAccount = nostrAccountScope(api.backendURL, session.member.username).storageAccount
            val otherAccount = nostrAccountScope(api.backendURL, "other-member").storageAccount
            val registered = "$ownAccount:registered"
            preferences.edit().putBoolean(ownAccount, true).putBoolean(otherAccount, true)
                .putStringSet(registered, setOf("remove", "retry")).commit()
            NostranslationAlerts.status.value = R.string.nostranslation_alerts_ready

            NostranslationAlerts.disable(context, api, session)
            assertFalse(NostranslationAlerts.isEnabled(context, api.backendURL, session))
            assertTrue(preferences.getBoolean(otherAccount, false))
            assertNull(NostranslationAlerts.status.value)
            await { preferences.getStringSet(registered, null) == setOf("retry") }
            assertEquals(setOf("remove", "retry"), setOf(takeRemoval(server), takeRemoval(server)))

            rejectRemoval.set(false)
            NostranslationAlerts.disable(context, api, session)
            await { preferences.getStringSet(registered, null) == emptySet<String>() }
            assertEquals("retry", takeRemoval(server))
            assertEquals(3, server.requestCount)
        }
    }

    @Test fun leavesTheAccountDisabledWhenTheServerHasNoAndroidKey() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse(body = """{"androidVapidKey":null}"""))
            server.start()
            val api = MobileApiClient(server.url("/").toString())
            val controller = Robolectric.buildActivity(Activity::class.java).setup()
            try {
                NostranslationAlerts.status.value = null
                NostranslationAlerts.enable(controller.get(), api, session)
                await { NostranslationAlerts.status.value == R.string.nostranslation_alerts_unavailable }
                assertFalse(NostranslationAlerts.isEnabled(context, api.backendURL, session))
                val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
                assertEquals("GET", request.method)
                assertEquals("/api/mobile/v0/nostranslation/alerts", request.target)
            } finally {
                controller.pause().stop().destroy()
            }
        }
    }

    @Test fun capturesOnlyTheAccountFromAReviewIntent() {
        val previous = NostranslationAlerts.openRequested.value
        try {
            NostranslationAlerts.openRequested.value = null
            NostranslationAlerts.captureIntent(null)
            NostranslationAlerts.captureIntent(Intent())
            assertNull(NostranslationAlerts.openRequested.value)

            val extra = "org.trustroots.android.OPEN_NOSTRANSLATION_REVIEW"
            NostranslationAlerts.captureIntent(Intent().putExtra(extra, "fixture-account"))
            assertEquals("fixture-account", NostranslationAlerts.openRequested.value)
        } finally {
            NostranslationAlerts.openRequested.value = previous
        }
    }

    private fun takeRemoval(server: MockWebServer): String {
        val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
        assertEquals("DELETE", request.method)
        assertEquals("/api/mobile/v0/nostranslation/alerts", request.target)
        assertEquals("Bearer fixture-access", request.headers["Authorization"])
        return JSONObject(requireNotNull(request.body).utf8()).getString("transport")
    }

    private fun await(condition: () -> Boolean) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (!condition() && System.nanoTime() < deadline) {
            shadowOf(Looper.getMainLooper()).idle()
            Thread.sleep(10)
        }
        assertTrue("The Nostranslation alert state did not settle", condition())
    }
}
