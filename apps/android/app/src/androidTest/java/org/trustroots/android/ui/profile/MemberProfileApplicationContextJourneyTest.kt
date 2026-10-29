package org.trustroots.android.ui.profile

import android.app.Application
import androidx.activity.ComponentActivity
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.core.view.WindowCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.LocalTransportFixture
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class MemberProfileApplicationContextJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        fixture?.close()
        fixture = null
    }

    @Test fun attachedApplicationContextLoadsProfileAndBackWithoutMutatingActivityWindow() {
        val apiFixture = LocalTransportFixture { request ->
            when (request.path) {
                "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                    """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox"}""",
                )
                "/api/offers-by/member-fox?types=host" -> LocalTransportFixture.Response("[]")
                "/api/contacts/member-fox" -> LocalTransportFixture.Response("[]")
                "/api/experiences?userTo=member-fox" -> LocalTransportFixture.Response("[]")
                "/api/contact-by/member-fox" -> LocalTransportFixture.Response("{}", status = 404)
                "/api/blocked-users" -> LocalTransportFixture.Response("[]")
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = apiFixture
        val backCalls = AtomicInteger()
        val initialLightStatusBars = AtomicReference<Boolean>()
        compose.activityRule.scenario.onActivity { activity ->
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            controller.isAppearanceLightStatusBars = true
            initialLightStatusBars.set(controller.isAppearanceLightStatusBars)
        }

        compose.runOnUiThread {
            val applicationContext = compose.activity.applicationContext
            assertTrue(applicationContext is Application)
            val embeddedComposeView = ComposeView(applicationContext).apply {
                setContent {
                    TrustrootsTheme {
                        MemberProfileScreen(
                            api = MobileApiClient(apiFixture.baseURL),
                            session = MemberSession(
                                "connect.sid=fictional-profile-session",
                                MobileMember("steady-heron", "Steady Heron"),
                            ),
                            username = "quiet-fox",
                            onSessionInvalidated = {},
                            onBack = { backCalls.incrementAndGet() },
                        )
                    }
                }
            }
            compose.activity.setContentView(embeddedComposeView)
        }

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Quiet Fox").fetchSemanticsNodes().isNotEmpty()
        }
        assertTrue(apiFixture.requests.any { it.path == "/api/users/quiet-fox" })
        compose.activityRule.scenario.onActivity { activity ->
            assertEquals(
                initialLightStatusBars.get(),
                WindowCompat.getInsetsController(activity.window, activity.window.decorView).isAppearanceLightStatusBars,
            )
        }

        compose.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitUntil(5_000) { backCalls.get() == 1 }
    }
}
