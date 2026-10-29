package org.trustroots.android.ui.hostmap

import androidx.activity.ComponentActivity
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.views.MapView
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.theme.TrustrootsTheme

@RunWith(AndroidJUnit4::class)
class HostMapStaleCircleFilterJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val requestScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @After fun cancelRequests() {
        requestScope.cancel()
    }

    @Test fun aSelectedCircleMissingFromTheLoadedListKeepsItsGenericFilterLabel() {
        val repository = EmptyCircleRepository()
        val viewModel = HostMapViewModel(
            repository = repository,
            notesClientFactory = { _, _ -> HostMapNotesConnection {} },
            scope = requestScope,
        )
        viewModel.onEvent(
            HostMapEvent.FiltersChanged(
                viewModel.state.value.filters.copy(circleIDs = setOf("deleted-circle")),
            ),
        )

        compose.setContent {
            TrustrootsTheme {
                HostMapScreen(
                    api = MobileApiClient("https://api.example.test"),
                    session = MemberSession("connect.sid=fictional-map-session", MobileMember("steady-heron", "Steady Heron")),
                    onSessionInvalidated = {},
                    viewModel = viewModel,
                    geocoderLookup = { _, _, _ -> emptyList() },
                    mapViewFactory = { context -> MapView(context).apply { setUseDataConnection(false) } },
                    notesClientFactory = { _, _ -> HostMapNotesConnection {} },
                )
            }
        }

        compose.onNodeWithTag("openFilters").performClick()
        compose.waitUntil(10_000) {
            repository.circleLoads > 0 &&
                compose.onAllNodesWithText("1 circle").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("1 circle").assertIsDisplayed().performClick()
        compose.onNodeWithTag("circleFilterOption-all").assertIsDisplayed()
        assertEquals(setOf("deleted-circle"), viewModel.state.value.filters.circleIDs)
    }

    private class EmptyCircleRepository : HostMapRepository {
        @Volatile
        var circleLoads = 0
            private set

        override suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters): Result<List<MapOffer>> =
            Result.success(emptyList())

        override suspend fun circles(): Result<List<TrustrootsCircle>> {
            circleLoads += 1
            return Result.success(emptyList())
        }

        override suspend fun visibleNostrAuthors(authors: Set<String>): Result<Set<String>> = Result.success(emptySet())

        override suspend fun places(query: String, maxResults: Int): Result<List<PlaceSuggestion>> = Result.success(emptyList())
    }
}
