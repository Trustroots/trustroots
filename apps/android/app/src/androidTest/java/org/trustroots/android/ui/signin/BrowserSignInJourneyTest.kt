package org.trustroots.android.ui.signin

import android.app.Activity
import android.app.Instrumentation
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.MainActivity
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.BrowserSignInCallback
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.ui.BrowserSignInJourneyActivity
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.SignInJourneyActivity
import org.trustroots.android.ui.common.UiFailureFallback

@RunWith(AndroidJUnit4::class)
class BrowserSignInJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val prefs = context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE)
    private val store = SecureMobileSessionStore(context)
    private lateinit var originalPreferences: Map<String, *>

    @Before fun clearAccount() {
        originalPreferences = prefs.all
        store.clear()
    }

    @After fun restoreAccount() {
        val editor = prefs.edit().clear()
        originalPreferences.forEach { (key, value) -> if (value is String) editor.putString(key, value) }
        assertTrue(editor.commit())
    }

    @Test fun browserCallbackThroughMainActivityRedeemsOnceAndSavesAnEncryptedSession() {
        val start = AtomicReference<Uri>()
        val launchAttempts = AtomicInteger()
        val code = "C".repeat(43)
        val browserMonitor = object : Instrumentation.ActivityMonitor() {
            override fun onStartActivity(intent: Intent): Instrumentation.ActivityResult? {
                val url = intent.data
                if (intent.action != Intent.ACTION_VIEW || url?.path != "/auth/mobile/start") return null
                assertTrue(intent.hasCategory(Intent.CATEGORY_BROWSABLE))
                if (launchAttempts.getAndIncrement() == 0) throw ActivityNotFoundException()
                start.set(url)
                return Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null)
            }
        }
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.addMonitor(browserMonitor)

        try {
            LocalTransportFixture { request ->
                when (request.path) {
                    "/api/mobile/v0/auth/signin" -> LocalTransportFixture.Response(
                        """{"code":"web_sign_in_required","message":"Complete authentication on the web."}""",
                        status = 403,
                    )
                    "/api/mobile/v0/auth/browser/exchange" -> {
                        val launchedUrl = requireNotNull(start.get())
                        val exchange = JSONObject(request.body)
                        val verifier = exchange.getString("codeVerifier")
                        val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
                            MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)),
                        )
                        assertEquals("POST", request.method)
                        assertEquals(setOf("code", "codeVerifier", "platform"), exchange.keys().asSequence().toSet())
                        assertEquals(code, exchange.getString("code"))
                        assertEquals("android", exchange.getString("platform"))
                        assertEquals(launchedUrl.getQueryParameter("code_challenge"), challenge)
                        assertFalse(launchedUrl.toString().contains(verifier))
                        assertNull(request.authorization)
                        assertNull(request.cookie)
                        LocalTransportFixture.Response(
                            """{"accessToken":"browser-access","refreshToken":"browser-refresh","member":{"username":"fictional-owl","displayName":"Fictional Owl"}}""",
                        )
                    }
                    else -> LocalTransportFixture.Response("{}", status = 404)
                }
            }.use { fixture ->
                val firstLaunch = activityIntent(fixture.baseURL)
                ActivityScenario.launch<BrowserSignInJourneyActivity>(firstLaunch).use { scenario ->
                    waitForText("Username or email")
                    compose.onNodeWithTag("signin-username").performScrollTo().performTextReplacement("fictional-owl")
                    compose.onNodeWithTag("signin-password").performScrollTo().performTextReplacement("fictional-password")
                    compose.onNodeWithText("Sign in").performScrollTo().performClick()
                    waitForText("Continue in browser")
                    assertNull(store.load())
                    compose.onNodeWithTag("signin-continue-browser").performScrollTo().performClick()
                    waitForText("Browser sign-in is unavailable.", substring = true)
                    compose.onNodeWithTag("signin-continue-browser").performScrollTo().performClick()
                    compose.waitUntil(10_000) { start.get() != null }
                    val url = requireNotNull(start.get())
                    assertEquals("android", url.getQueryParameter("platform"))
                    assertFalse(url.toString().contains("fictional-owl"))
                    assertFalse(url.toString().contains("fictional-password"))

                    scenario.onActivity { activity ->
                        activity.startActivity(
                            activityIntent(fixture.baseURL, callbackURL(code, "D".repeat(43)))
                                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                        )
                    }
                    waitForText("Could not finish browser sign-in.", substring = true)
                    assertFalse(fixture.requests.any { it.path.endsWith("/browser/exchange") })
                    assertNull(store.load())
                }

                val state = requireNotNull(start.get().getQueryParameter("state"))
                assertFalse(prefs.all.values.any { it.toString().contains(state) })
                val validCallback = activityIntent(fixture.baseURL, callbackURL(code, state))
                ActivityScenario.launch<BrowserSignInJourneyActivity>(validCallback).use {
                    compose.waitUntil(10_000) { store.load()?.member?.username == "fictional-owl" }
                    assertEquals("browser-access", store.load()?.accessToken)
                    assertEquals("browser-refresh", store.load()?.refreshToken)
                    assertFalse(prefs.all.values.any { it.toString().contains("browser-access") })
                }

                store.clear()
                ActivityScenario.launch<BrowserSignInJourneyActivity>(validCallback).use {
                    waitForText("Could not finish browser sign-in.", substring = true)
                    assertNull(store.load())
                }
                assertEquals(1, fixture.requests.count { it.path.endsWith("/browser/exchange") })
            }
        } finally {
            instrumentation.removeMonitor(browserMonitor)
        }
    }

    @Test fun missingBrowserIsReportedWithoutChangingAppState() {
        val missingBrowserContext = object : ContextWrapper(context) {
            override fun startActivity(intent: Intent) {
                throw ActivityNotFoundException()
            }
        }
        assertFalse(launchSystemBrowser(missingBrowserContext, "https://www.trustroots.org/auth/mobile/start"))
    }

    @Test fun regularLaunchAndWarmNonBrowserIntentStillUseMainActivity() {
        val launch = Intent(context, MainActivity::class.java)
        val marker = "org.trustroots.android.test.WARM_INTENT"
        ActivityScenario.launch<MainActivity>(launch).use { scenario ->
            waitForText("Username or email")
            scenario.onActivity {
                it.startActivity(Intent(launch).putExtra(marker, true).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP))
            }
            compose.waitUntil(10_000) {
                var captured = false
                scenario.onActivity { captured = it.intent.getBooleanExtra(marker, false) }
                captured
            }
        }
    }

    @Test fun onlyValidViewIntentsReplaceThePendingCallback() {
        val links = BrowserSignInLinks()
        val firstCode = "A".repeat(43)
        val secondCode = "B".repeat(43)
        val state = "C".repeat(43)
        val first = Intent(Intent.ACTION_VIEW, Uri.parse(callbackURL(firstCode, state)))
        assertTrue(links.capture(first))
        val pendingFirst = requireNotNull(links.callback.value)
        assertEquals(callbackURL(firstCode, state), first.dataString)
        assertFalse(links.capture(Intent(Intent.ACTION_VIEW)))
        assertFalse(links.capture(Intent(Intent.ACTION_SEND, Uri.parse(callbackURL(secondCode, state)))))
        assertFalse(links.capture(Intent(Intent.ACTION_VIEW, Uri.parse("https://elsewhere.test/mobile-auth/complete"))))
        assertEquals(firstCode, links.callback.value?.code)
        val second = Intent(Intent.ACTION_VIEW, Uri.parse(callbackURL(secondCode, state)))
        assertTrue(links.capture(second))
        val pendingSecond = requireNotNull(links.callback.value)
        val consumedCodes = mutableListOf<String>()
        links.consume(pendingFirst) { consumedCodes.add(it.code) }
        assertTrue(consumedCodes.isEmpty())
        assertEquals(secondCode, pendingSecond.code)
        links.consume(pendingSecond) { consumedCodes.add(it.code) }
        assertEquals(listOf(secondCode), consumedCodes)
        assertTrue(links.capture(second))
        assertNull(links.callback.value)
    }

    @Test fun browserOpenAndExchangeCannotBeStartedAgainWhileAnExchangeIsRunning() = runBlocking {
        val exchangeStarted = CountDownLatch(1)
        val finishExchange = CountDownLatch(1)
        val scope = CoroutineScope(Dispatchers.Unconfined + SupervisorJob())
        LocalTransportFixture {
            exchangeStarted.countDown()
            assertTrue(finishExchange.await(12, TimeUnit.SECONDS))
            LocalTransportFixture.Response("{}", status = 503)
        }.use { api ->
            try {
                val model = SignInViewModel(
                    api.baseURL, null,
                    SignInAuthenticator { _, _ -> Result.failure(MobileApiException(403, code = "web_sign_in_required")) },
                    scope, store,
                )
                var launches = 0
                var state: String? = null
                val openBrowser: (String) -> Boolean = {
                    launches++
                    state = Uri.parse(it).getQueryParameter("state")
                    throw ActivityNotFoundException()
                }
                model.startBrowserSignIn(openBrowser)
                assertEquals(0, launches)
                model.onEvent(SignInEvent.UsernameChanged("fictional-owl"))
                model.onEvent(SignInEvent.PasswordChanged("fictional-password"))
                model.onEvent(SignInEvent.Submit)
                model.startBrowserSignIn(openBrowser)
                assertEquals(1, launches)
                assertEquals(UiFailureFallback.BROWSER_SIGN_IN_UNAVAILABLE, model.state.value.error?.fallback)
                val callback = BrowserSignInCallback("C".repeat(43), requireNotNull(state))
                model.completeBrowserSignIn(callback)
                assertTrue(exchangeStarted.await(10, TimeUnit.SECONDS))
                model.startBrowserSignIn(openBrowser)
                model.completeBrowserSignIn(callback)
                assertEquals(1, launches)
                assertTrue(model.state.value.isLoading)
                finishExchange.countDown()
                val result = withTimeout(10_000) { model.state.first { !it.isLoading } }
                assertEquals(UiFailureFallback.BROWSER_SIGN_IN_RETRY, result.error?.fallback)
                assertEquals(1, api.requests.size)
            } finally {
                finishExchange.countDown()
                scope.cancel()
            }
        }
    }

    private fun waitForText(text: String, substring: Boolean = false) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text, substring = substring).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun callbackURL(code: String, state: String) =
        "https://www.trustroots.org/mobile-auth/complete?code=$code&state=$state"

    private fun activityIntent(baseURL: String, callbackURL: String? = null) =
        Intent(context, BrowserSignInJourneyActivity::class.java).apply {
            putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, baseURL)
            if (callbackURL != null) {
                action = Intent.ACTION_VIEW
                data = Uri.parse(callbackURL)
            }
        }
}
