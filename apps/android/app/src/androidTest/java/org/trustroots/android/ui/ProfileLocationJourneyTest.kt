package org.trustroots.android.ui

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class ProfileLocationJourneyTest {
    @get:Rule val compose = createComposeRule()

    @Test fun profileWithoutCurrentLocationUsesTheLocalisedOriginLabel() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val expected = context.getString(R.string.member_location_from, "Imaginary Coast")
        LocalTransportFixture { request ->
            when (request.path) {
                "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                    """{"_id":"fictional-member","username":"quiet-fox","displayName":"Quiet Fox","locationFrom":"Imaginary Coast"}""",
                )
                "/api/contact-by/fictional-member" -> LocalTransportFixture.Response("{}", 404)
                else -> LocalTransportFixture.Response("[]")
            }
        }.use { fixture ->
            val api = MobileApiClient(fixture.baseURL)
            compose.setContent {
                TrustrootsTheme {
                    MemberProfileScreen(
                        api = api,
                        session = MemberSession("connect.sid=fictional-location", MobileMember("steady-heron", "Steady Heron")),
                        username = "quiet-fox", onSessionInvalidated = {}, onBack = {},
                    )
                }
            }
            compose.waitUntil(10_000) { compose.onAllNodesWithText(expected).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText(expected).performScrollTo().assertIsDisplayed()
        }
    }
}
