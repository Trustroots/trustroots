package org.trustroots.android.ui

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MessageMember
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.ui.hostdetail.HostDetailRepository
import org.trustroots.android.ui.hostdetail.HostDetailScreen
import org.trustroots.android.ui.hostdetail.HostDetailViewModel
import org.trustroots.android.ui.search.HostDetailVisit
import org.trustroots.android.ui.search.SearchOfferType
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HostDetailSurfaceJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val session = MemberSession("connect.sid=fictional-session", MobileMember("steady-heron", "Steady Heron"))
    private val padding = PaddingValues(start = 24.dp, top = 32.dp, end = 40.dp, bottom = 96.dp)
    private var modelScope: CoroutineScope? = null

    @After fun cancelModelScope() {
        modelScope?.cancel()
    }

    @Test fun loadedSheetStaysWhiteWithAsymmetricInsetsAndAccessibleCloseTarget() {
        val backCalls = mutableListOf<Int>()
        render(
            repository = repository { Result.success(offer()) },
            dark = false,
            onBack = { backCalls += 1 },
        )

        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("A fictional room above the map.").fetchSemanticsNodes().isNotEmpty()
        }
        assertWhiteSheetInterior()
        assertSheetInsets()
        val close = compose.onNodeWithContentDescription("Close host result")
        close.assertIsDisplayed().assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
        close.performClick()
        assertEquals(listOf(1), backCalls)
    }

    @Test fun loadingSheetStaysWhiteAndKeepsA48DpCloseTargetInDarkAppearance() {
        val pendingOffer = CompletableDeferred<Result<HostOffer>>()
        val loadingBackCalls = mutableListOf<Int>()
        render(
            repository = repository { pendingOffer.await() },
            dark = true,
            onBack = { loadingBackCalls += 1 },
        )
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("hostDetailLoading").fetchSemanticsNodes().isNotEmpty()
        }
        assertWhiteSheetInterior()
        assertSheetInsets()
        compose.onNodeWithContentDescription("Close host result")
            .assertIsDisplayed().assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
            .performClick()
        assertEquals(listOf(1), loadingBackCalls)
        pendingOffer.complete(Result.success(offer()))
    }

    @Test fun failureSheetStaysWhiteAndKeepsA48DpCloseTargetInDarkAppearance() {
        val failureBackCalls = mutableListOf<Int>()
        render(
            repository = repository { Result.failure(IOException("fictional transport failure")) },
            dark = true,
            onBack = { failureBackCalls += 1 },
        )
        compose.waitUntil(10_000) {
            compose.onAllNodesWithTag("hostDetailRetry").fetchSemanticsNodes().isNotEmpty()
        }
        assertWhiteSheetInterior()
        assertSheetInsets()
        compose.onNodeWithContentDescription("Close host result")
            .assertIsDisplayed().assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
            .performClick()
        assertEquals(listOf(1), failureBackCalls)
    }

    private fun render(
        repository: HostDetailRepository,
        dark: Boolean,
        onBack: () -> Unit,
    ) {
        modelScope?.cancel()
        modelScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val model = HostDetailViewModel(repository, modelScope)
        val baseContext = compose.activity
        val configuration = Configuration(baseContext.resources.configuration).apply {
            uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
                if (dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
        }
        val themedContext = baseContext.createConfigurationContext(configuration)
        compose.setContent {
            CompositionLocalProvider(
                LocalContext provides themedContext,
                LocalConfiguration provides configuration,
            ) {
                TrustrootsTheme {
                    HostDetailScreen(
                        api = MobileApiClient("http://127.0.0.1:1"),
                        session = session,
                        route = HostDetailVisit("offer-one", SearchOfferType.Host, visitID = 1L),
                        onBack = onBack,
                        onOpenProfile = {},
                        onSessionInvalidated = {},
                        contentPadding = padding,
                        viewModel = model,
                    )
                }
            }
        }
    }

    private fun assertWhiteSheetInterior() {
        val pixels = compose.onNodeWithTag("hostDetailSheet").captureToImage().toPixelMap()
        val x = with(compose.density) { 4.dp.roundToPx() }
        assertEquals("The HostDetail sheet should use its XML white surface", Color.White, pixels[x, pixels.height / 2])
    }

    private fun assertSheetInsets() {
        val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
        val sheet = compose.onNodeWithTag("hostDetailSheet").fetchSemanticsNode().boundsInRoot
        with(compose.density) {
            assertTrue("Sheet respects the logical start inset", sheet.left >= root.left + padding.calculateLeftPadding(androidx.compose.ui.unit.LayoutDirection.Ltr).toPx() - 1f)
            assertTrue("Sheet respects the end inset", sheet.right <= root.right - padding.calculateRightPadding(androidx.compose.ui.unit.LayoutDirection.Ltr).toPx() + 1f)
            assertTrue("Sheet respects the bottom inset", sheet.bottom <= root.bottom - padding.calculateBottomPadding().toPx() + 1f)
        }
    }

    private fun offer() = HostOffer(
        "offer-one",
        "yes",
        "A fictional room above the map.",
        2,
        MessageMember(null, "quiet-fox", "Quiet Fox"),
    )

    private fun repository(offerResult: suspend () -> Result<HostOffer>) = object : HostDetailRepository {
        override suspend fun offer(offerID: String) = offerResult()
        override suspend fun profile(username: String) = Result.success(
            MemberProfile(null, username, "Quiet Fox", null, null, null, languages = emptyList()),
        )
        override suspend fun memberships() = Result.success(emptySet<String>())
    }
}
