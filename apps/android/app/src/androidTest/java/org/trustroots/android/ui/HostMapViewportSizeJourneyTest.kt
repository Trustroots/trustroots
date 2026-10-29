package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CopyOnWriteArrayList
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
import org.osmdroid.views.MapView
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.hostmap.HostMapFilters
import org.trustroots.android.ui.hostmap.HostMapNotesConnection
import org.trustroots.android.ui.hostmap.HostMapRepository
import org.trustroots.android.ui.hostmap.HostMapScreen
import org.trustroots.android.ui.hostmap.HostMapViewModel
import org.trustroots.android.ui.hostmap.MapBounds
import org.trustroots.android.ui.hostmap.PlaceSuggestion
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HostMapViewportSizeJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val repository = RecordingHostMapRepository()
    private val model = HostMapViewModel(
        repository = repository,
        notesClientFactory = { _, _ -> HostMapNotesConnection {} },
        scope = scope,
    )

    @After fun cancelMapScope() {
        scope.cancel()
    }

    @Test fun viewportWaitsForBothDimensionsBeforePublishingBoundsOrSearching() {
        val dimensions = mutableStateOf(420.dp to 0.dp)
        compose.setContent {
            TrustrootsTheme {
                Box(Modifier.width(dimensions.value.first).height(dimensions.value.second)) {
                    HostMapScreen(
                        api = MobileApiClient("http://127.0.0.1:1"),
                        session = MemberSession("connect.sid=fictional", MobileMember("steady-heron", "Steady Heron")),
                        onSessionInvalidated = {},
                        viewModel = model,
                        mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false) } },
                    )
                }
            }
        }

        compose.waitUntil(5_000) { model.state.value.mapVisible }
        compose.waitForIdle()
        assertNullViewport("A zero-height map must not publish bounds")

        compose.runOnIdle { dimensions.value = 0.dp to 360.dp }
        compose.waitForIdle()
        assertNullViewport("A zero-width map must not publish bounds")

        compose.runOnIdle { dimensions.value = 420.dp to 360.dp }
        compose.waitUntil(10_000) {
            model.state.value.measuredBounds != null && repository.searches.isNotEmpty()
        }

        val measured = requireNotNull(model.state.value.measuredBounds)
        assertTrue("The published map bounds should have positive latitude span", measured.north > measured.south)
        assertTrue("The published map bounds should have positive longitude span", measured.east > measured.west)
        assertTrue("The map should search with the measured valid viewport", repository.searches.any { it == measured })
    }

    private fun assertNullViewport(message: String) {
        assertEquals(message, null, model.state.value.measuredBounds)
        assertTrue("Zero-sized map viewports must not trigger a search", repository.searches.isEmpty())
    }

    private class RecordingHostMapRepository : HostMapRepository {
        val searches = CopyOnWriteArrayList<MapBounds>()

        override suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters): Result<List<MapOffer>> {
            searches += bounds
            return Result.success(emptyList())
        }

        override suspend fun circles(): Result<List<TrustrootsCircle>> = Result.success(emptyList())
        override suspend fun visibleNostrAuthors(authors: Set<String>): Result<Set<String>> = Result.success(authors)
        override suspend fun places(query: String, maxResults: Int): Result<List<PlaceSuggestion>> = Result.success(emptyList())
    }
}
