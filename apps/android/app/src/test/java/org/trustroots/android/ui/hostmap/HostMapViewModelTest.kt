package org.trustroots.android.ui.hostmap

import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.trustroots.android.api.CommunityNote
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class HostMapViewModelTest {
    @Test
    fun filtersViewportAndLastSuccessfulSearchSurviveMapDisposalAndReentry() = withViewModel { viewModel, repository, _ ->
        val bounds = bounds()
        val viewport = MapViewport(38.5, -9.5, 8.0)
        val result = MapOffer("search-result", 38.4, -9.4)
        repository.searchHandler = { _, _, _ -> Result.success(listOf(result)) }
        viewModel.onEvent(HostMapEvent.ViewportChanged(viewport, bounds))
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true, languages = setOf("eng"))))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))

        assertEquals(1, repository.searchCalls)
        assertEquals(listOf(result), viewModel.state.value.offers)
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(false))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))

        assertEquals(1, repository.searchCalls)
        assertEquals(viewport, viewModel.state.value.viewport)
        assertEquals(bounds, viewModel.state.value.measuredBounds)
        assertEquals(setOf("eng"), viewModel.state.value.filters.languages)
        assertTrue(viewModel.state.value.filters.includeMeet)
    }

    @Test
    fun disablingEveryOfferTypeClearsResultsAndReenablingRunsTheSearchAgain() = withViewModel { viewModel, repository, _ ->
        val first = MapOffer("first-result", 38.4, -9.4)
        repository.searchHandler = { _, _, _ -> Result.success(listOf(first)) }
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(), bounds()))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))

        assertEquals(1, repository.searchCalls)
        assertEquals(listOf(first), viewModel.state.value.offers)

        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeHosts = false, includeMeet = false)))
        assertEquals(1, repository.searchCalls)
        assertTrue(viewModel.state.value.offers.isEmpty())

        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters()))
        assertEquals("re-enabling the previous filter must re-fetch after its results were cleared", 2, repository.searchCalls)
        assertEquals(listOf(first), viewModel.state.value.offers)
    }

    @Test
    fun lateSearchResultAfterHideDoesNotReplaceNewVisibleAreaResults() = withViewModel { viewModel, repository, _ ->
        val first = CompletableDeferred<Result<List<MapOffer>>>()
        val current = MapOffer("current-result", 38.3, -9.3)
        repository.searchHandler = { call, _, _ ->
            if (call == 1) withContext(NonCancellable) { first.await() }
            else Result.success(listOf(current))
        }
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(), bounds()))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        assertEquals(1, repository.searchCalls)
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(false))
        first.complete(Result.success(listOf(MapOffer("late-result", 38.0, -9.0))))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))

        assertEquals(2, repository.searchCalls)
        assertEquals(listOf(current), viewModel.state.value.offers)
    }

    @Test
    fun resetCancelsLateCircleAndPlaceCompletions() = withViewModel { viewModel, repository, _ ->
        val oldCircles = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        val oldPlaces = CompletableDeferred<Result<List<PlaceSuggestion>>>()
        repository.circleHandler = { withContext(NonCancellable) { oldCircles.await() } }
        repository.placeHandler = { _, _ -> withContext(NonCancellable) { oldPlaces.await() } }

        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Old place"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)
        viewModel.onEvent(HostMapEvent.Reset(1))

        oldCircles.complete(Result.success(listOf(circle("late-circle"))))
        oldPlaces.complete(Result.success(listOf(PlaceSuggestion("Late place", 1.0, 2.0))))

        val state = viewModel.state.value
        assertTrue(state.offers.isEmpty())
        assertTrue(state.circles.isEmpty())
        assertTrue(state.suggestions.isEmpty())
        assertEquals("", state.locationQuery)
        assertEquals(MapViewport(), state.viewport)
    }

    @Test
    fun staleCircleResponseCannotOverwriteReset() = withViewModel { viewModel, repository, _ ->
        val circleRequest = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        repository.circleHandler = { withContext(NonCancellable) { circleRequest.await() } }
        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.Reset(2))
        circleRequest.complete(Result.success(listOf(circle("stale-circle"))))
        assertTrue(viewModel.state.value.circles.isEmpty())
    }

    @Test
    fun latestPlaceQueryWinsWhenAnOlderGeocoderRequestFinishesLate() = withViewModel { viewModel, repository, _ ->
        val oldPlace = CompletableDeferred<Result<List<PlaceSuggestion>>>()
        repository.placeHandler = { query, _ ->
            if (query.equals("Old place", ignoreCase = true)) withContext(NonCancellable) { oldPlace.await() }
            else Result.success(listOf(PlaceSuggestion("Current place", 12.0, 34.0)))
        }
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Old place"))
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Current query"))
        oldPlace.complete(Result.success(listOf(PlaceSuggestion("Obsolete place", 1.0, 2.0))))

        assertEquals(listOf(PlaceSuggestion("Current place", 12.0, 34.0)), viewModel.state.value.suggestions)
    }

    @Test
    fun resetRestoresDefaultsAndIgnoresDuplicateGeneration() = withViewModel { viewModel, _, _ ->
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(38.5, -9.5, 8.0), bounds()))
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true, languages = setOf("eng"))))
        viewModel.onEvent(HostMapEvent.PlaceSelected(PlaceSuggestion("Fictional place", 12.0, 34.0)))
        viewModel.onEvent(HostMapEvent.Reset(7))
        val reset = viewModel.state.value

        assertEquals(HostMapFilters(), reset.filters)
        assertNull(reset.measuredBounds)
        assertEquals(MapViewport(), reset.viewport)
        assertTrue(reset.viewportCommand != null)
        viewModel.onEvent(HostMapEvent.Reset(7))
        assertEquals(reset, viewModel.state.value)
    }

    @Test
    fun notesConnectionClosesReopensAndIgnoresCallbacksFromStoppedConnection() = withViewModel { viewModel, _, notesConnections ->
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        val first = notesConnections.connections.single()
        assertEquals(1, notesConnections.opened)

        viewModel.onEvent(HostMapEvent.OwnerLifecycleChanged(false))
        assertEquals(1, first.closeCalls)
        first.emit(note("stale-note"))
        first.fail()
        assertTrue(viewModel.state.value.communityNotes.isEmpty())
        assertFalse(viewModel.state.value.noteError)

        viewModel.onEvent(HostMapEvent.OwnerLifecycleChanged(true))
        val second = notesConnections.connections.last()
        assertEquals(2, notesConnections.opened)
        second.emit(note("current-note"))
        second.fail()
        assertEquals(listOf("current-note"), viewModel.state.value.communityNotes.map { it.id })
        assertTrue(viewModel.state.value.noteError)
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(false))
        assertEquals(1, second.closeCalls)
    }

    @Test
    fun entryClearClosesNotesSourceAndCancelsOwnedRequests() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeHostMapRepository()
        val connections = FakeNotesConnections()
        val pendingCircles = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        val pendingPlace = CompletableDeferred<Result<List<PlaceSuggestion>>>()
        repository.circleHandler = { withContext(NonCancellable) { pendingCircles.await() } }
        repository.placeHandler = { _, _ -> withContext(NonCancellable) { pendingPlace.await() } }
        val owner = TestStoreOwner()
        val viewModel = androidx.lifecycle.ViewModelProvider(
            owner,
            HostMapViewModel.Factory(repository, { onNote, onError -> connections.open(onNote, onError) }, scope),
        ).get(HostMapViewModel::class.java)
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Entry owned place"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)
        assertEquals(1, connections.opened)

        owner.viewModelStore.clear()
        pendingCircles.complete(Result.success(listOf(circle("late-entry-circle"))))
        pendingPlace.complete(Result.success(listOf(PlaceSuggestion("Late entry place", 1.0, 2.0))))
        connections.connections.single().emit(note("after-clear"))

        assertEquals(1, connections.connections.single().closeCalls)
        assertEquals(HostMapUiState(ownerStarted = false), viewModel.state.value)
        assertTrue(viewModel.state.value.circles.isEmpty())
        scope.cancel()
    }

    @Test
    fun sessionChangeCancelsPendingHostCircleAndPlaceResults() = withViewModel { viewModel, repository, _ ->
        val pendingCircles = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        val pendingPlace = CompletableDeferred<Result<List<PlaceSuggestion>>>()
        repository.circleHandler = { withContext(NonCancellable) { pendingCircles.await() } }
        repository.placeHandler = { _, _ -> withContext(NonCancellable) { pendingPlace.await() } }
        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Old session place"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)

        viewModel.updateSession(session("cookie-replacement"))
        pendingCircles.complete(Result.success(listOf(circle("obsolete-circle"))))
        pendingPlace.complete(Result.success(listOf(PlaceSuggestion("Obsolete place", 1.0, 2.0))))

        assertEquals(HostMapUiState(), viewModel.state.value)
    }

    private fun withViewModel(test: (HostMapViewModel, FakeHostMapRepository, FakeNotesConnections) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeHostMapRepository()
        val notes = FakeNotesConnections()
        try {
            val viewModel = HostMapViewModel(repository, { onNote, onError -> notes.open(onNote, onError) }, scope) { }
            test(viewModel, repository, notes)
        } finally {
            scope.cancel()
        }
    }

    private class FakeHostMapRepository : HostMapRepository {
        var sessionCookie = "cookie-initial"
        var searchCalls = 0
        var circleCalls = 0
        var searchHandler: suspend (Int, MapBounds, HostMapFilters) -> Result<List<MapOffer>> = { _, _, _ -> Result.success(emptyList()) }
        var circleHandler: suspend () -> Result<List<TrustrootsCircle>> = { Result.success(listOf(circle("circle-safe-id"))) }
        var placeHandler: suspend (String, Int) -> Result<List<PlaceSuggestion>> = { _, _ -> Result.success(emptyList()) }

        override fun updateSession(session: MemberSession): Boolean {
            val changed = sessionCookie != session.cookieHeader
            sessionCookie = session.cookieHeader
            return changed
        }

        override suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters): Result<List<MapOffer>> {
            searchCalls++
            return searchHandler(searchCalls, bounds, filters)
        }
        override suspend fun circles(): Result<List<TrustrootsCircle>> {
            circleCalls++
            return circleHandler()
        }
        override suspend fun visibleNostrAuthors(authors: Set<String>) = Result.success(authors)
        override suspend fun places(query: String, maxResults: Int) = placeHandler(query, maxResults)
    }

    private class FakeNotesConnections {
        var opened = 0
        val connections = mutableListOf<FakeNotesConnection>()

        fun open(onNote: (CommunityNote) -> Unit, onError: () -> Unit): HostMapNotesConnection {
            opened++
            return FakeNotesConnection(onNote, onError).also(connections::add)
        }
    }

    private class FakeNotesConnection(
        private val onNote: (CommunityNote) -> Unit,
        private val onError: () -> Unit,
    ) : HostMapNotesConnection {
        var closeCalls = 0
        override fun close() {
            closeCalls++
        }
        fun emit(note: CommunityNote) = onNote(note)
        fun fail() = onError()
    }

    private class TestStoreOwner : ViewModelStoreOwner {
        override val viewModelStore = ViewModelStore()
    }

    private companion object {
        fun bounds() = MapBounds(38.0, -10.0, 39.0, -9.0)
        fun circle(id: String) = TrustrootsCircle(id, "circle", "Circle", null, 1, false, null)
        fun note(id: String) = CommunityNote(id, "Anonymous note", 1L, 38.0, -9.0, "anonymous-author")
        fun session(cookie: String) = MemberSession(cookie, MobileMember("anonymous-member", "Anonymous Member"))
    }
}
