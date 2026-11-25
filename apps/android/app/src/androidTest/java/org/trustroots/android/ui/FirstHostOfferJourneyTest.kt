package org.trustroots.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class FirstHostOfferJourneyTest {
    @get:Rule val compose = createComposeRule()
    private val session = MemberSession(
        "connect.sid=fictional-host-session",
        MobileMember("steady-heron", "Steady Heron"),
    )
    private val invalidations = AtomicInteger()
    private val createResponseGate = CountDownLatch(1)
    private val updateResponseGate = CountDownLatch(1)
    private var fixture: LocalTransportFixture? = null

    @After fun closeFixture() {
        createResponseGate.countDown()
        updateResponseGate.countDown()
        fixture?.close()
        fixture = null
    }

    @Test fun createsFirstOfferThenUpdatesItUsingTheReturnedId() {
        val local = LocalTransportFixture { request ->
            when {
                request.method == "GET" && request.path == "/api/users/steady-heron" ->
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-member-id","username":"steady-heron","displayName":"Steady Heron"}""",
                    )
                request.method == "GET" && request.path == "/api/offers-by/fictional-member-id?types=host" ->
                    LocalTransportFixture.Response("""{"message":"Not found."}""", status = 404)
                request.method == "POST" && request.path == "/api/offers" -> {
                    createResponseGate.await(10, TimeUnit.SECONDS)
                    LocalTransportFixture.Response(
                        """{"_id":"fictional-offer-id","message":"Offer created."}""",
                    )
                }
                request.method == "PUT" && request.path == "/api/offers/fictional-offer-id" -> {
                    updateResponseGate.await(10, TimeUnit.SECONDS)
                    LocalTransportFixture.Response(
                        """{"message":"Offer updated."}""",
                    )
                }
                else -> LocalTransportFixture.Response("{}", status = 404)
            }
        }
        fixture = local

        compose.setContent {
            TrustrootsTheme {
                HostOfferScreen(
                    api = MobileApiClient(local.baseURL),
                    session = session,
                    onSessionInvalidated = { invalidations.incrementAndGet() },
                    onBack = {},
                )
            }
        }

        compose.waitUntil(10_000) {
            local.requests.any { it.method == "GET" && it.path == "/api/offers-by/fictional-member-id?types=host" } &&
                compose.onAllNodesWithText("Hosting description").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Hosting description").performTextReplacement("A fictional room for visitors.")
        compose.onNodeWithText("Save changes").assertIsNotEnabled()
        compose.onNodeWithText("Latitude").performScrollTo().performTextReplacement("40.25")
        compose.onNodeWithText("Longitude").performScrollTo().performTextReplacement("-8.5")
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            local.requests.any { it.method == "POST" && it.path == "/api/offers" } &&
                runCatching { compose.onNodeWithText("Saving…").assertIsNotEnabled() }.isSuccess
        }

        val create = local.requests.single { it.method == "POST" && it.path == "/api/offers" }
        val createBody = JSONObject(create.body)
        assertEquals(session.cookieHeader, create.cookie)
        assertEquals("host", createBody.getString("type"))
        assertEquals("yes", createBody.getString("status"))
        assertEquals("A fictional room for visitors.", createBody.getString("description"))
        assertEquals(1, createBody.getInt("maxGuests"))
        assertEquals("[40.25,-8.5]", createBody.getJSONArray("location").toString())
        assertFalse(createBody.getBoolean("showOnlyInMyCircles"))
        createResponseGate.countDown()

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Hosting offer saved.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Hosting offer saved.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Hosting description")
            .performScrollTo().performTextReplacement("A fictional room with a garden.")
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            local.requests.any { it.method == "PUT" && it.path == "/api/offers/fictional-offer-id" } &&
                runCatching { compose.onNodeWithText("Saving…").assertIsNotEnabled() }.isSuccess
        }

        val update = local.requests.single {
            it.method == "PUT" && it.path == "/api/offers/fictional-offer-id"
        }
        val updateBody = JSONObject(update.body)
        assertEquals(session.cookieHeader, update.cookie)
        assertEquals("host", updateBody.getString("type"))
        assertEquals("yes", updateBody.getString("status"))
        assertEquals("A fictional room with a garden.", updateBody.getString("description"))
        updateResponseGate.countDown()

        compose.waitUntil(10_000) {
            local.requests.count { it.method == "PUT" } == 1 &&
                runCatching { compose.onNodeWithText("Save changes").assertIsEnabled() }.isSuccess
        }
        compose.onNodeWithText("Hosting offer saved.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("meeting-status-maybe").performScrollTo().performClick()
        compose.onNodeWithText("Save changes").performClick()
        compose.waitUntil(10_000) {
            local.requests.count { it.method == "PUT" } == 2 &&
                runCatching { compose.onNodeWithText("Save changes").assertIsEnabled() }.isSuccess
        }
        val secondUpdate = JSONObject(local.requests.last().body)
        assertEquals("maybe", secondUpdate.getString("meetingStatus"))
        assertEquals("[40.25,-8.5]", secondUpdate.getJSONArray("location").toString())
        assertEquals(0, invalidations.get())
        assertEquals(
            listOf(
                "/api/users/steady-heron",
                "/api/offers-by/fictional-member-id?types=host",
                "/api/offers",
                "/api/offers/fictional-offer-id",
                "/api/offers/fictional-offer-id",
            ),
            local.requests.map { it.path },
        )
        assertTrue(local.requests.all { it.cookie == session.cookieHeader })
    }
}
