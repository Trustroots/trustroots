package org.trustroots.android.ui

import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.printToLog

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedDispatcher
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.MessageDestination
import org.trustroots.android.ui.circles.CircleDetailVisit
import org.trustroots.android.ui.hostmap.MapViewport

@RunWith(AndroidJUnit4::class)
class Navigation3MemberShellJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val sessionPreferences by lazy { context.getSharedPreferences("mobile-session", Context.MODE_PRIVATE) }
    private val alertPreferences by lazy { context.getSharedPreferences("message-alerts", Context.MODE_PRIVATE) }
    private lateinit var previousSessionPreferences: Map<String, *>
    private lateinit var previousAlertPreferences: Map<String, *>
    private var previousAlertStatus: String? = null
    private var previousAlertStatusMetadata: MessageAlertStatusMetadata? = null
    private var previousAlertDestination: MessageDestination? = null
    private var scenario: ActivityScenario<SignInJourneyActivity>? = null
    @Volatile private var circlesResponse = "[]"
    @Volatile private var circlesStatus = 200
    @Volatile private var failFirstCircleDetailLoad = false
    private val circleReads = AtomicInteger()
    private val circleDetailReads = AtomicInteger()
    private val membershipReads = AtomicInteger()
    private val accountReads = AtomicInteger()
    private val accountWrites = AtomicInteger()
    private val messageReads = AtomicInteger()
    private val joinedHarbour = AtomicBoolean(false)
    @Volatile private var membershipResponseGate: CountDownLatch? = null
    @Volatile private var expireMemberSearch = false
    @Volatile private var expireHostMap = false
    @Volatile private var hostMapOffers = """{"features":[]}"""
    private val fixture = LocalTransportFixture { request ->
        when {
            request.method == "POST" && request.path == "/api/auth/signin" -> LocalTransportFixture.Response(
                """{"username":"amber-owl","displayName":"Amber Owl"}""",
                headers = mapOf("Set-Cookie" to "connect.sid=second-fictional-session; Path=/; HttpOnly"),
            )
            request.path.startsWith("/api/users/amber-owl") -> LocalTransportFixture.Response(
                """{"_id":"member-new","username":"amber-owl","displayName":"Amber Owl","email":"amber@example.test","newsletter":false}""",
            )
            request.path.startsWith("/api/users?search=") -> if (expireMemberSearch) {
                LocalTransportFixture.Response("""{"message":"Session expired."}""", 401)
            } else {
                LocalTransportFixture.Response(
                    """[{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","location":"Harbour"}]""",
                )
            }
            request.path == "/api/users/quiet-fox" -> LocalTransportFixture.Response(
                """{"_id":"member-fox","username":"quiet-fox","displayName":"Quiet Fox","tagline":"A fictional traveller"}""",
            )
            request.path.startsWith("/api/users/steady-heron") -> {
                accountReads.incrementAndGet()
                LocalTransportFixture.Response(
                    """{"_id":"member-self","username":"steady-heron","displayName":"Steady Heron","email":"member@example.test","newsletter":false}""",
                )
            }
            request.path == "/api/users" && request.method == "PUT" -> {
                accountWrites.incrementAndGet()
                LocalTransportFixture.Response(
                    """{"username":"steady-heron","displayName":"Steady Heron","email":"draft@example.test","newsletter":false}""",
                )
            }
            request.path.startsWith("/api/messages?") -> {
                messageReads.incrementAndGet()
                LocalTransportFixture.Response("[]")
            }
            request.path == "/api/tribes?limit=150" -> {
                circleReads.incrementAndGet()
                val body = if (circlesStatus in 200..299) circlesResponse
                else """{"message":"The circle catalogue is temporarily unavailable."}"""
                LocalTransportFixture.Response(body, circlesStatus)
            }
            request.path == "/api/tribes/quiet-harbour" -> {
                val attempt = circleDetailReads.incrementAndGet()
                if (failFirstCircleDetailLoad && attempt == 1) {
                    LocalTransportFixture.Response("""{"message":"Circle not found."}""", 404)
                } else {
                    LocalTransportFixture.Response(
                        """{"_id":"circle-harbour","slug":"quiet-harbour","label":"Canonical Quiet Harbour","description":"<p>Detail loaded from its own endpoint.</p>","count":4,"image":false}""",
                    )
                }
            }
            request.path == "/api/tribes/mountain-paths" -> LocalTransportFixture.Response(
                """{"_id":"circle-mountain","slug":"mountain-paths","label":"Mountain Circle","description":"<p>High mountain paths.</p>","count":7,"image":false}""",
            )
            request.path == "/api/users/memberships/circle-harbour" -> {
                joinedHarbour.set(request.method == "POST")
                LocalTransportFixture.Response("{}")
            }
            request.path == "/api/users/memberships" -> {
                membershipReads.incrementAndGet()
                membershipResponseGate?.await(10, TimeUnit.SECONDS)
                LocalTransportFixture.Response(
                    if (joinedHarbour.get()) """[{"tribe":{"_id":"circle-harbour"}}]""" else "[]",
                )
            }
            request.path.startsWith("/api/offers?") -> if (expireHostMap) {
                LocalTransportFixture.Response("""{"message":"Session expired."}""", 401)
            } else {
                LocalTransportFixture.Response(hostMapOffers)
            }
            request.path == "/api/offers/overlay-offer" -> LocalTransportFixture.Response(
                """{"_id":"overlay-offer","status":"yes","description":"A fictional room above the map.","maxGuests":2,"user":{"username":"quiet-fox","displayName":"Quiet Fox"}}""",
            )
            request.path.contains("/avatar?") -> LocalTransportFixture.Response("", 404)
            else -> LocalTransportFixture.Response("[]")
        }
    }

    @Before fun saveAndClearShellState() {
        previousSessionPreferences = sessionPreferences.all
        previousAlertPreferences = alertPreferences.all
        previousAlertStatus = MessageAlerts.status.value
        previousAlertStatusMetadata = MessageAlerts.statusMetadata.value
        previousAlertDestination = MessageAlerts.destination.value
        sessionPreferences.edit().clear().commit()
        alertPreferences.edit().clear().commit()
        MessageAlerts.clearDestination()
        circlesResponse = "[]"
        circlesStatus = 200
        failFirstCircleDetailLoad = false
        circleReads.set(0)
        circleDetailReads.set(0)
        membershipReads.set(0)
        accountReads.set(0)
        accountWrites.set(0)
        messageReads.set(0)
        joinedHarbour.set(false)
        expireMemberSearch = false
        expireHostMap = false
        hostMapOffers = """{"features":[]}"""
        SecureMobileSessionStore(context).save(
            MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron")),
        )
    }

    @After fun closeScenarioAndRestoreShellState() {
        membershipResponseGate?.countDown()
        scenario?.close()
        fixture.close()
        restorePreferences(sessionPreferences, previousSessionPreferences)
        restorePreferences(alertPreferences, previousAlertPreferences)
        MessageAlerts.destination.value = previousAlertDestination
        MessageAlerts.status.value = previousAlertStatus
        MessageAlerts.statusMetadata.value = previousAlertStatusMetadata
    }

    @Test fun repeatedTabVisitsRestoreAcrossActivityRecreationAndPredictiveBack() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.waitUntil(10_000) { accountReads.get() >= 1 }
        assertEquals("The shell should finish its initial avatar/profile read once", 1, accountReads.get())
        waitForStableMessageReads(1)

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        waitForStableMessageReads(3) // one shell badge poll and one inbox load
        compose.onNodeWithTag("navigation-messages").performClick()
        waitForStableMessageReads(4) // new-visit badge poll; the fresh inbox is reused
        compose.onNodeWithTag("inboxLoading").assertDoesNotExist()
        compose.onNodeWithTag("navigation-circles").performClick()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()

        requirePredictiveBackSupport()
        cancelPredictiveBack()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()

        requireNotNull(scenario).recreate()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        compose.waitForIdle()
        assertEquals("Activity recreation retains the successful shell/avatar lookup", 1, accountReads.get())

        cancelPredictiveBack()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        completePredictiveBack()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        completePredictiveBack()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
    }

    @Test fun circlesVisitRetainsAccountStateAndFreshVisitsResetAndReload() {
        circlesResponse = """[
            {"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","description":"<p>Quiet sea routes.</p>","count":4,"image":false},
            {"_id":"circle-mountain","slug":"mountain-paths","label":"Mountain Circle","description":"<p>High mountain paths.</p>","count":7,"image":false}
        ]"""
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Quiet Harbour")
        compose.waitUntil(10_000) { circleReads.get() == 1 && membershipReads.get() == 1 }

        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("sea")
        compose.onNodeWithText("Quiet Harbour").performClick()
        waitForEnabledText("Join circle")
        compose.onNodeWithText("Join circle").assertIsEnabled().performClick()
        waitForText("Leave circle")
        compose.waitUntil(5_000) { joinedHarbour.get() }
        val initialCircleReads = circleReads.get()
        val initialMembershipReads = membershipReads.get()

        requireNotNull(scenario).recreate()
        waitForText("Leave circle")
        assertEquals(initialCircleReads, circleReads.get())
        assertEquals(initialMembershipReads, membershipReads.get())
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNode(hasSetTextAction()).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Mountain Circle")
        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("mountain")
        compose.onNodeWithText("Mountain Circle").performClick()
        waitForText("High mountain paths.")
        pressBack()
        compose.onNodeWithText("Mountain Circle").assertIsDisplayed()
        compose.onNodeWithText("Quiet Harbour").assertDoesNotExist()

        pressBack()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        pressBack()
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()
        assertEquals(2, circleReads.get())
        assertEquals("Overview and detail entries load membership independently", 4, membershipReads.get())

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Mountain Circle")
        compose.waitUntil(5_000) { circleReads.get() == 3 && membershipReads.get() == 5 }
        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("sea")
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Mountain Circle")
        compose.waitUntil(5_000) { circleReads.get() == 4 && membershipReads.get() == 6 }
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertIsDisplayed()
    }

    @Test fun accountEntryRetainsDraftAcrossActivityRecreationWithoutRepeatingLoad() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        // The shell separately resolves its own profile/avatar from this same
        // endpoint before Account is opened, so record the stable baseline.
        compose.waitUntil(5_000) { accountReads.get() >= 1 }
        assertEquals("The shell should resolve the signed-in member once", 1, accountReads.get())
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Account").performScrollTo().performClick()
        waitForText("member@example.test")
        compose.waitUntil(5_000) { accountReads.get() >= 2 }
        assertEquals("Opening one Account entry should make one additional account request", 2, accountReads.get())

        compose.onNodeWithText("Email address").performScrollTo().performTextReplacement("draft@example.test")
        requireNotNull(scenario).recreate()
        waitForText("draft@example.test")
        // Both decorated entries retain their loaded state across recreation.
        // Neither the shell avatar nor the Account draft needs another read.
        assertEquals("Recreation retains the shell and Account profile reads", 2, accountReads.get())

        compose.onNodeWithText("Save email settings").performScrollTo().performClick()
        waitForText("Account saved.")
        assertEquals(1, accountWrites.get())
    }

    @Test fun failedCircleCatalogueLoadCanBeRetriedFromTheScreen() {
        circlesResponse = """[{"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","description":"A coastal circle.","count":4,"image":false}]"""
        circlesStatus = 503
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("The circle catalogue is temporarily unavailable.")
        circlesStatus = 200
        compose.onNodeWithText("Retry").assertIsDisplayed().performClick()
        compose.waitUntil(10_000) { circleReads.get() >= 2 }
        waitForText("Quiet Harbour")
        assertEquals(2, circleReads.get())
        assertEquals(2, membershipReads.get())
    }

    @Test fun circleDetailUsesItsOwnEntryAndRestoresFilterAndMembershipAcrossRecreation() {
        circlesResponse = """[
            {"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","description":"Overview summary.","count":4,"image":false},
            {"_id":"circle-mountain","slug":"mountain-paths","label":"Mountain Circle","description":"High mountain paths.","count":7,"image":false}
        ]"""
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Quiet Harbour")
        compose.waitUntil(10_000) { circleReads.get() == 1 && membershipReads.get() == 1 }
        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("harbour")
        val membershipsReady = CountDownLatch(1)
        membershipResponseGate = membershipsReady
        compose.onNodeWithText("Quiet Harbour").performClick()
        try {
            waitForText("Detail loaded from its own endpoint.")
            compose.onNodeWithText("Join circle").assertIsNotEnabled()
        } finally {
            membershipsReady.countDown()
        }
        waitForEnabledText("Join circle")
        compose.onNodeWithText("Join circle").assertIsEnabled().performClick()
        waitForText("Leave circle")
        compose.waitUntil(5_000) { joinedHarbour.get() }

        requireNotNull(scenario).recreate()
        waitForText("Detail loaded from its own endpoint.")
        compose.waitUntil(5_000) { circleDetailReads.get() == 1 }
        assertEquals("detail reload must not refetch the retained catalogue", 1, circleReads.get())
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNode(hasSetTextAction()).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()
        compose.onNodeWithText("Joined").assertIsDisplayed()
        assertEquals("returning from detail must reuse overview data", 1, circleReads.get())
        assertEquals("overview and detail each load their own memberships once", 2, membershipReads.get())

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Quiet Harbour")
        compose.waitUntil(5_000) { circleReads.get() == 2 && membershipReads.get() == 3 }
        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("mountain")
        compose.onNodeWithText("Mountain Circle").performClick()
        waitForText("High mountain paths.")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Quiet Harbour")
        compose.onNodeWithText("Mountain Circle").assertIsDisplayed()
        assertEquals("reselecting Circles should open a fresh overview visit", 3, circleReads.get())
    }

    @Test fun missingCircleDetailCanRetryAndPredictiveBackReturnsToFilteredOverview() {
        circlesResponse = """[
            {"_id":"circle-harbour","slug":"quiet-harbour","label":"Quiet Harbour","description":"Overview summary.","count":4,"image":false},
            {"_id":"circle-mountain","slug":"mountain-paths","label":"Mountain Circle","description":"High mountain paths.","count":7,"image":false}
        ]"""
        failFirstCircleDetailLoad = true
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Quiet Harbour")
        compose.waitUntil(10_000) { circleReads.get() == 1 && membershipReads.get() == 1 }
        compose.onNode(hasSetTextAction()).performScrollTo().performTextReplacement("harbour")
        compose.onNodeWithText("Quiet Harbour").performClick()
        compose.onNodeWithText("Retry").assertIsDisplayed()
        assertEquals("opening an unknown detail must preserve the existing overview", 1, circleReads.get())
        assertEquals(1, circleDetailReads.get())

        compose.onNodeWithText("Retry").performClick()
        waitForText("Detail loaded from its own endpoint.")
        compose.waitUntil(5_000) { circleDetailReads.get() == 2 && membershipReads.get() == 2 }
        assertEquals("retrying detail must not reload the catalogue", 1, circleReads.get())

        requirePredictiveBackSupport()
        cancelPredictiveBack()
        compose.onNodeWithText("Detail loaded from its own endpoint.").assertIsDisplayed()
        completePredictiveBack()
        compose.onNode(hasSetTextAction()).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Quiet Harbour").assertIsDisplayed()
        compose.onNodeWithText("Mountain Circle").assertDoesNotExist()
        assertEquals("returning from detail must reuse the filtered overview", 1, circleReads.get())
    }

    @Test fun circleDetailRouteSerialisesOnlyCanonicalSlugAndVisitID() {
        val route = CircleDetailVisit(slug = "quiet-harbour", visitID = 17L)
        val encoded = Json.encodeToString(CircleDetailVisit.serializer(), route)
        val fields = Json.parseToJsonElement(encoded).jsonObject

        assertEquals(setOf("slug", "visitID"), fields.keys)
        assertEquals(route, Json.decodeFromString(CircleDetailVisit.serializer(), encoded))
    }

    @Test fun topLevelNavigationWaitsForDirtyProfileLeaveDecision() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performClick()
        waitForText("Tagline")
        compose.onNodeWithText("Tagline").performTextReplacement("A new anonymous line")
        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("A new anonymous line").assertIsDisplayed()

        compose.onNodeWithTag("navigation-search").performClick()
        compose.onNodeWithText("Discard changes").performClick()
        waitForText("Search places")
        compose.onNodeWithTag("navigation-search").assertIsSelected()
        pressSystemBack()
        waitForText("View your profile")
        compose.onNodeWithText("A new anonymous line").assertDoesNotExist()
    }

    @Test fun menuChildRouteRestoresAfterActivityRecreationAndReturnsThroughItsOrigins() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")

        compose.onNodeWithTag("navigation-messages").performClick()
        waitForText("No conversations yet.")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("People you connect with on Trustroots will appear here.")

        requireNotNull(scenario).recreate()
        waitForText("People you connect with on Trustroots will appear here.")
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("View your profile").assertExists()

        pressSystemBack()
        compose.onNodeWithText("No conversations yet.").assertIsDisplayed()
        compose.onNodeWithTag("navigation-messages").assertIsSelected()
        pressSystemBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
    }

    @Test fun nestedSystemBackWaitsForDirtyEditProfileDecision() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        waitForText("Tagline")
        compose.onNodeWithText("Tagline").performTextReplacement("A fictional route change")
        compose.waitForIdle()

        pressSystemBack()
        compose.onNodeWithText("Discard changes?").assertIsDisplayed()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("A fictional route change").assertIsDisplayed()

        pressSystemBack()
        compose.onNodeWithText("Discard changes").performClick()
        waitForText("View your profile")
        pressSystemBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
    }

    @Test fun nestedPredictiveBackCancelsWithoutPoppingAndThenReturnsToMenuOrigin() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-menu").performClick()
        compose.onNodeWithText("Contacts").performScrollTo().performClick()
        waitForText("People you connect with on Trustroots will appear here.")

        requirePredictiveBackSupport()
        cancelPredictiveBack()
        compose.onNodeWithText("Contacts").assertIsDisplayed()
        completePredictiveBack()
        compose.onNodeWithText("View your profile").assertExists()
        compose.onNodeWithTag("navigation-menu").assertIsSelected()

        completePredictiveBack()
        compose.onNodeWithText("Discover circles").assertIsDisplayed()
        compose.onNodeWithTag("navigation-circles").assertIsSelected()
    }

    @Test fun memberSearchStateSurvivesModeTabAndActivityChangesAndResetsOnReselection() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()

        compose.onNodeWithTag("memberSearchField").performTextReplacement("quiet")
        compose.onNodeWithContentDescription("Search members").performClick()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A fictional traveller")
        requireNotNull(scenario).recreate()
        waitForText("A fictional traveller")
        pressBack()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        requireNotNull(scenario).recreate()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Hosts map").performClick()
        waitForText("Search places")
        selectMembersMode()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")

        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Discover circles")
        pressBack()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")

        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A fictional traveller")
        compose.onNodeWithTag("navigation-circles").performClick()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        waitForText("Find a member")
        assertTrue(compose.onAllNodesWithText("A fictional traveller").fetchSemanticsNodes().isEmpty())
        assertMemberSearchText("")
        pressBack()
        waitForText("Search places")
        pressBack()
        waitForText("Discover circles")
        pressBack()
        waitForText("A fictional traveller")
        compose.onNodeWithTag("profilePager").assertIsDisplayed()
        pressBack()
        waitForText("Quiet Fox")
        assertMemberSearchText("quiet")

        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        assertMemberSearchText("")
        waitForText("Find a member")
        compose.onNodeWithTag("memberSearchField").performTextReplacement("after reset")
        requireNotNull(scenario).recreate()
        waitForText("Find a member")
        assertMemberSearchText("after reset")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })
    }

    @Test fun mapVisitRetainsCameraAndFiltersAcrossActivityRecreationWithoutRepeatingItsQuery() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        compose.waitUntil(10_000) { fixture.requests.any { it.path.startsWith("/api/offers?") } }
        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            map.controller.setCenter(GeoPoint(40.0, -4.0))
            map.controller.setZoom(8.0)
        }
        compose.waitUntil(10_000) { fixture.requests.count { it.path.startsWith("/api/offers?") } >= 2 }
        compose.onNodeWithTag("openFilters").performClick()
        val queriesBeforeFilter = fixture.requests.count { it.path.startsWith("/api/offers?") }
        compose.onNodeWithText("Last active: 6 months").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        compose.waitUntil(10_000) {
            fixture.requests.count { it.path.startsWith("/api/offers?") } > queriesBeforeFilter
        }
        waitForText(context.getString(
            org.trustroots.android.R.string.screen_map_statistics,
            context.resources.getQuantityString(org.trustroots.android.R.plurals.screen_offers_count, 0, 0),
            context.resources.getQuantityString(org.trustroots.android.R.plurals.screen_nostroots_notes_count, 0, 0),
        ))
        val viewport = AtomicReference<MapViewport>()
        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            viewport.set(MapViewport(map.mapCenter.latitude, map.mapCenter.longitude, map.zoomLevelDouble))
        }
        val completedQueries = fixture.requests.count { it.path.startsWith("/api/offers?") }
        requireNotNull(scenario).recreate()
        waitForText("Search places")
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: any time").assertIsDisplayed()
        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            assertEquals(viewport.get().latitude, map.mapCenter.latitude, 0.00001)
            assertEquals(viewport.get().longitude, map.mapCenter.longitude, 0.00001)
            assertEquals(viewport.get().zoom, map.zoomLevelDouble, 0.001)
        }
        // Observe beyond the real 550 ms map debounce to catch a delayed duplicate.
        Thread.sleep(1_200)
        assertEquals(
            "Offer requests after recreation: ${fixture.requests.filter { it.path.startsWith("/api/offers?") }.map { it.path }}",
            completedQueries,
            fixture.requests.count { it.path.startsWith("/api/offers?") },
        )
    }

    @Test fun hostDetailDialogRestoresAboveTheSameMapEntryWithoutRepeatingRequests() {
        hostMapOffers = """{"features":[{"properties":{"id":"overlay-offer","type":"host","status":"yes"},"geometry":{"coordinates":[-9.1393,38.7223]}}]}"""
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        compose.waitUntil(15_000) {
            compose.onAllNodesWithText("1 offer · 0 Nostroots notes in this area").fetchSemanticsNodes().isNotEmpty()
        }
        val mapBefore = AtomicReference<MapView>()
        val viewportBefore = AtomicReference<MapViewport>()
        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            mapBefore.set(map)
            viewportBefore.set(MapViewport(map.mapCenter.latitude, map.mapCenter.longitude, map.zoomLevelDouble))
        }
        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        waitForText("A fictional room above the map.")
        compose.onNodeWithTag("hostResultCard").assertIsDisplayed()
        val sheetPixels = compose.onNodeWithTag("hostDetailSheet").captureToImage().toPixelMap()
        val interiorX = with(compose.density) { 4.dp.roundToPx() }
        assertEquals(Color.White, sheetPixels[interiorX, sheetPixels.height / 2])
        compose.onNodeWithContentDescription("Close host result")
            .assertIsDisplayed().assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
        val detailCalls = fixture.requests.count { it.path == "/api/offers/overlay-offer" }
        assertEquals("Opening the marker loads one host preview", 1, detailCalls)
        compose.onNodeWithText("Quiet Fox").performClick()
        waitForText("A fictional traveller")
        pressBack()
        compose.onNodeWithTag("hostMapView").assertIsDisplayed()
        compose.onNodeWithTag("hostResultCard").assertDoesNotExist()
        compose.onNodeWithText("A fictional room above the map.").assertDoesNotExist()
        requireNotNull(scenario).onActivity { activity ->
            assertTrue("Returning from the profile preserves the Search map", findMapView(activity.window.decorView) === mapBefore.get())
        }

        compose.onNodeWithTag("hostMapView").performTouchInput { click(center) }
        waitForText("A fictional room above the map.")
        compose.onNodeWithTag("hostResultCard").assertIsDisplayed()
        val reopenedDetailCalls = fixture.requests.count { it.path == "/api/offers/overlay-offer" }
        assertEquals("Opening the marker again fetches a fresh host preview", detailCalls + 1, reopenedDetailCalls)
        val searchCalls = fixture.requests.count { it.path.startsWith("/api/offers?") }
        requireNotNull(scenario).onActivity { activity ->
            assertTrue("The map remains mounted below its detail dialog", findMapView(activity.window.decorView) === mapBefore.get())
        }

        requireNotNull(scenario).recreate()
        waitForText("A fictional room above the map.")
        compose.onNodeWithTag("hostResultCard").assertIsDisplayed()
        compose.waitUntil(10_000) {
            findMapFromActivity()?.let { it.isAttachedToWindow } == true
        }
        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            assertEquals(viewportBefore.get().latitude, map.mapCenter.latitude, 0.01)
            assertEquals(viewportBefore.get().longitude, map.mapCenter.longitude, 0.01)
            assertEquals(viewportBefore.get().zoom, map.zoomLevelDouble, 0.1)
        }
        Thread.sleep(800)
        assertEquals(reopenedDetailCalls, fixture.requests.count { it.path == "/api/offers/overlay-offer" })
        assertEquals(searchCalls, fixture.requests.count { it.path.startsWith("/api/offers?") })

        try {
            pressBack()
            compose.onNodeWithTag("hostMapView").assertIsDisplayed()
            compose.onNodeWithText("A fictional room above the map.").assertDoesNotExist()
            requireNotNull(scenario).onActivity { activity ->
                assertTrue("Back reveals the preserved map", findMapView(activity.window.decorView) != null)
            }
        } catch (failure: AssertionError) {
            compose.onRoot(useUnmergedTree = true).printToLog("SearchBack")
            val currentMap = findMapFromActivity()
            throw AssertionError(
                "Back did not reveal the expected Search map route: " +
                    "expectedMapPresent=${mapBefore.get() != null}, " +
                    "currentMapPresent=${currentMap != null}, " +
                    "sameMap=${currentMap === mapBefore.get()}, " +
                    "mapAttached=${currentMap?.isAttachedToWindow}, " +
                    "hostMapViewNodes=${compose.onAllNodesWithTag("hostMapView", useUnmergedTree = true).fetchSemanticsNodes().size}, " +
                    "hostResultCardNodes=${compose.onAllNodesWithTag("hostResultCard", useUnmergedTree = true).fetchSemanticsNodes().size}, " +
                    "placeSearchFieldNodes=${compose.onAllNodesWithTag("placeSearchField", useUnmergedTree = true).fetchSemanticsNodes().size}, " +
                    "detailDescriptionNodes=${compose.onAllNodesWithText("A fictional room above the map.", useUnmergedTree = true).fetchSemanticsNodes().size}",
                failure,
            )
        }
    }

    private fun findMapFromActivity(): MapView? {
        val map = AtomicReference<MapView?>()
        scenario?.onActivity { activity -> map.set(findMapView(activity.window.decorView)) }
        return map.get()
    }

    private fun findMapView(view: View): MapView? = when (view) {
        is MapView -> view
        is ViewGroup -> (0 until view.childCount).firstNotNullOfOrNull { findMapView(view.getChildAt(it)) }
        else -> null
    }

    @Test fun expiredMemberSearchClearsTheSearchEntryForANewAccount() {
        expireMemberSearch = true
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        compose.onNodeWithTag("memberSearchField").performTextReplacement("expired query")
        compose.onNodeWithContentDescription("Search members").performClick()
        waitForText("Your session expired or is no longer valid. Please sign in again.")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })

        signInAsAmberOwl()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        selectMembersMode()
        waitForText("Find a member")
        assertMemberSearchText("")
        assertEquals(1, fixture.requests.count { it.path.startsWith("/api/users?search=") })
        assertEquals("connect.sid=fictional-session", fixture.requests.single { it.path.startsWith("/api/users?search=") }.cookie)
    }

    @Test fun expiredHostMapClearsFiltersAndCameraForANewAccount() {
        scenario = ActivityScenario.launch(
            Intent(context, SignInJourneyActivity::class.java)
                .putExtra(SignInJourneyActivity.API_BASE_URL_EXTRA, fixture.baseURL),
        )
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        compose.waitUntil(10_000) {
            fixture.requests.any { it.path.startsWith("/api/offers?") && it.cookie == "connect.sid=fictional-session" }
        }

        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            map.controller.setCenter(GeoPoint(40.0, -4.0))
            map.controller.setZoom(8.0)
        }
        compose.waitUntil(10_000) {
            fixture.requests.count { it.path.startsWith("/api/offers?") && it.cookie == "connect.sid=fictional-session" } >= 2
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
        val requestsBeforeExpiredFilter = fixture.requests.count {
            it.path.startsWith("/api/offers?") && it.cookie == "connect.sid=fictional-session"
        }
        expireHostMap = true
        compose.onNodeWithText("Last active: 6 months").performClick()
        waitForText("Your session expired or is no longer valid. Please sign in again.")
        compose.waitUntil(10_000) {
            fixture.requests.count {
                it.path.startsWith("/api/offers?") && it.cookie == "connect.sid=fictional-session"
            } > requestsBeforeExpiredFilter
        }

        expireHostMap = false
        signInAsAmberOwl()
        waitForText("Discover circles")
        compose.onNodeWithTag("navigation-search").performClick()
        waitForText("Search places")
        compose.waitUntil(10_000) {
            fixture.requests.any { it.path.startsWith("/api/offers?") && it.cookie == "connect.sid=second-fictional-session" }
        }
        compose.onNodeWithTag("openFilters").performClick()
        compose.onNodeWithText("Last active: 6 months").assertIsDisplayed()
        requireNotNull(scenario).onActivity { activity ->
            val map = requireNotNull(findMapView(activity.window.decorView))
            assertEquals(38.7223, map.mapCenter.latitude, 0.01)
            assertEquals(-9.1393, map.mapCenter.longitude, 0.01)
            assertEquals(6.5, map.zoomLevelDouble, 0.1)
        }
        assertTrue(fixture.requests.any {
            it.path.startsWith("/api/offers?") && it.cookie == "connect.sid=second-fictional-session"
        })
    }

    private fun signInAsAmberOwl() {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("signin-username").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("signin-username").performTextReplacement("amber-owl")
        compose.onNodeWithTag("signin-password").performTextReplacement("fictional-renewal-password")
        compose.onNodeWithText("Sign in").performScrollTo().performClick()
        waitForText("Discover circles")
        assertEquals(
            "connect.sid=second-fictional-session",
            SecureMobileSessionStore(context).load()?.cookieHeader,
        )
        assertEquals(1, fixture.requests.count { it.method == "POST" && it.path == "/api/auth/signin" })
    }

    private fun selectMembersMode() {
        compose.onNodeWithContentDescription("Search mode").performClick()
        compose.onNodeWithText("Members").performClick()
        compose.onNodeWithTag("memberSearchField").assertIsDisplayed()
    }

    private fun assertMemberSearchText(expected: String) {
        compose.onNodeWithTag("memberSearchField").assert(
            SemanticsMatcher.expectValue(
                SemanticsProperties.EditableText,
                AnnotatedString(expected),
            ),
        )
    }

    private fun pressBack() {
        compose.waitForIdle()
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun requirePredictiveBackSupport() {
        assumeTrue("Predictive back event dispatch requires Android 14+", Build.VERSION.SDK_INT >= 34)
    }

    private fun pressSystemBack() {
        requireNotNull(scenario).onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun cancelPredictiveBack() {
        withBackDispatcher { dispatcher ->
            dispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackProgressed(BackEventCompat(30f, 100f, 0.45f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackCancelled()
        }
    }

    private fun completePredictiveBack() {
        withBackDispatcher { dispatcher ->
            dispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
            dispatcher.dispatchOnBackProgressed(BackEventCompat(30f, 100f, 0.9f, BackEventCompat.EDGE_LEFT))
            dispatcher.onBackPressed()
        }
    }

    private fun withBackDispatcher(action: (OnBackPressedDispatcher) -> Unit) {
        var dispatcher: OnBackPressedDispatcher? = null
        requireNotNull(scenario).onActivity { dispatcher = it.onBackPressedDispatcher }
        compose.runOnUiThread { action(requireNotNull(dispatcher)) }
        compose.waitForIdle()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForEnabledText(text: String) {
        compose.waitUntil(10_000) {
            runCatching { compose.onNodeWithText(text).assertIsEnabled() }.isSuccess
        }
    }

    private fun waitForStableMessageReads(expected: Int) {
        var stableSince = 0L
        compose.waitUntil(10_000) {
            if (messageReads.get() != expected) {
                stableSince = 0L
                false
            } else {
                val now = SystemClock.elapsedRealtime()
                if (stableSince == 0L) stableSince = now
                now - stableSince >= 400
            }
        }
        assertEquals("Expected one shell badge poll plus any inbox load", expected, messageReads.get())
    }

    private fun restorePreferences(preferences: android.content.SharedPreferences, values: Map<String, *>) {
        val editor = preferences.edit().clear()
        values.forEach { (key, value) ->
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }
        editor.commit()
    }
}
