package org.trustroots.android.ui.hostmap

import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import java.io.IOException
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
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.ui.common.UiFailureFallback

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
    fun retrySearchRetriesTheSameBoundsAndFiltersAfterATransientFailure() = withViewModel { viewModel, repository, _ ->
        val expectedBounds = bounds()
        val expectedFilters = HostMapFilters(includeMeet = true, languages = setOf("eng"))
        val result = MapOffer("retry-result", 38.4, -9.4)
        repository.searchHandler = { call, _, _ ->
            if (call == 1) Result.failure(IOException("Temporary map search failure"))
            else Result.success(listOf(result))
        }
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(), expectedBounds))
        viewModel.onEvent(HostMapEvent.FiltersChanged(expectedFilters))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))

        assertEquals(UiFailureFallback.HOST_SEARCH, viewModel.state.value.failure?.fallback)
        assertTrue(viewModel.state.value.offers.isEmpty())
        viewModel.onEvent(HostMapEvent.RetrySearch)

        assertEquals(2, repository.searchCalls)
        assertEquals(listOf(result), viewModel.state.value.offers)
        assertEquals(expectedBounds, repository.searchedBounds.last())
        assertEquals(expectedFilters, repository.searchedFilters.last())
        assertNull(viewModel.state.value.failure)
    }

    @Test
    fun expiredSearchSessionStopsRequestsUntilAChangedSessionIsInstalled() = withViewModel { viewModel, repository, _ ->
        val expectedBounds = bounds()
        repository.searchHandler = { call, _, _ ->
            if (call == 1) Result.failure(MobileApiException(401, "Expired"))
            else Result.success(listOf(MapOffer("renewed-result", 38.4, -9.4)))
        }
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(), expectedBounds))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        val invalidation = requireNotNull(viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(HostMapEvent.RetrySearch)
        viewModel.onEvent(HostMapEvent.SessionInvalidationDelivered(invalidation.id))
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(39.0, -8.0), bounds(39.0)))
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("A fictional place"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)
        viewModel.onEvent(HostMapEvent.CirclesRequested)
        assertEquals(1, repository.searchCalls)
        assertTrue(repository.placeQueries.isEmpty())
        assertEquals(0, repository.circleCalls)

        viewModel.updateSession(session("cookie-renewed"))
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(39.0, -8.0), bounds(39.0)))

        assertEquals(2, repository.searchCalls)
        assertNull(viewModel.state.value.pendingSessionInvalidation)
        assertEquals(listOf(MapOffer("renewed-result", 38.4, -9.4)), viewModel.state.value.offers)
        assertEquals(bounds(39.0), repository.searchedBounds.last())
    }

    @Test
    fun stoppedOwnerDefersMapSearchUntilTheOwnerResumes() = withViewModel { viewModel, repository, _ ->
        viewModel.onEvent(HostMapEvent.OwnerLifecycleChanged(false))
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(), bounds()))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))

        assertEquals(0, repository.searchCalls)
        assertFalse(viewModel.state.value.isLoading)

        viewModel.onEvent(HostMapEvent.OwnerLifecycleChanged(true))

        assertEquals(1, repository.searchCalls)
        assertEquals(bounds(), repository.searchedBounds.single())
    }

    @Test
    fun placeSuggestionAuthenticationFailureInvalidatesSessionAndBlocksMoreGeocoding() = withViewModel { viewModel, repository, _ ->
        repository.placeHandler = { _, _ -> Result.failure(MobileApiException(401, "Expired")) }
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Known fictional place"))

        val invalidation = requireNotNull(viewModel.state.value.pendingSessionInvalidation)
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Another fictional place"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)

        assertEquals(1, repository.placeQueries.size)
        assertEquals(invalidation, viewModel.state.value.pendingSessionInvalidation)
        assertTrue(viewModel.state.value.suggestions.isEmpty())
        assertNull(viewModel.state.value.placeFailure)
    }

    @Test
    fun placeSubmissionReportsNoMatchThenAppliesTheFirstSuccessfulSuggestion() = withViewModel { viewModel, repository, _ ->
        repository.placeHandler = { query, maxResults ->
            assertTrue(maxResults in 1..3)
            if (query == "Unmapped place") Result.success(emptyList())
            else Result.success(listOf(PlaceSuggestion("Mapped place", 12.0, 34.0)))
        }
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Unmapped place"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)
        assertEquals(UiFailureFallback.PLACE_SEARCH, viewModel.state.value.placeFailure?.fallback)

        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Mapped query"))
        viewModel.onEvent(HostMapEvent.SubmitPlace)

        assertEquals("Mapped place", viewModel.state.value.locationQuery)
        assertEquals(MapViewport(12.0, 34.0, 9.0), viewModel.state.value.viewport)
        assertNull(viewModel.state.value.placeFailure)
        assertTrue(viewModel.state.value.suggestions.isEmpty())
    }

    @Test
    fun shortQueriesClearSuggestionsAndBlankSubmissionSkipsGeocoding() = withViewModel { viewModel, repository, _ ->
        repository.placeHandler = { query, _ ->
            Result.success(listOf(PlaceSuggestion(query, 12.0, 34.0)))
        }
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Long enough place"))
        assertEquals(listOf(PlaceSuggestion("Long enough place", 12.0, 34.0)), viewModel.state.value.suggestions)
        assertEquals(listOf("Long enough place" to 3), repository.placeQueries)

        viewModel.onEvent(HostMapEvent.LocationQueryChanged("  ab "))
        assertTrue(viewModel.state.value.suggestions.isEmpty())
        assertEquals("A query shorter than three characters should not reach the geocoder", listOf("Long enough place" to 3), repository.placeQueries)
        viewModel.onEvent(HostMapEvent.LocationQueryChanged(""))
        viewModel.onEvent(HostMapEvent.SubmitPlace)

        assertTrue(viewModel.state.value.suggestions.isEmpty())
        assertEquals(listOf("Long enough place" to 3), repository.placeQueries)
    }

    @Test
    fun circleRequestsAreDeduplicatedWhilePendingAndAfterAResultIsCached() = withViewModel { viewModel, repository, _ ->
        val pending = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        repository.circleHandler = { withContext(NonCancellable) { pending.await() } }

        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.CirclesRequested)
        assertEquals(1, repository.circleCalls)

        pending.complete(Result.success(listOf(circle("circle-cached"))))
        assertEquals(listOf(circle("circle-cached")), viewModel.state.value.circles)
        viewModel.onEvent(HostMapEvent.CirclesRequested)

        assertEquals("A successfully loaded non-empty circle list is reused", 1, repository.circleCalls)
    }

    @Test
    fun failedCircleLoadCanBeRetriedAndSuccessfulResultIsThenCached() = withViewModel { viewModel, repository, _ ->
        repository.circleHandler = {
            if (repository.circleCalls == 1) Result.failure(IllegalStateException("Temporary circle failure"))
            else Result.success(listOf(circle("retry-circle")))
        }

        viewModel.onEvent(HostMapEvent.CirclesRequested)
        assertEquals(UiFailureFallback.CIRCLES_LOAD, viewModel.state.value.failure?.fallback)

        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.CirclesRequested)

        assertEquals(2, repository.circleCalls)
        assertEquals(listOf("retry-circle"), viewModel.state.value.circles.map { it.id })
        assertNull(viewModel.state.value.failure)
    }

    @Test
    fun successfulCircleLoadDoesNotClearAConcurrentHostSearchFailure() = withViewModel { viewModel, repository, _ ->
        val pendingCircles = CompletableDeferred<Result<List<TrustrootsCircle>>>()
        repository.circleHandler = { withContext(NonCancellable) { pendingCircles.await() } }
        repository.searchHandler = { _, _, _ -> Result.failure(IOException("Temporary host search failure")) }

        viewModel.onEvent(HostMapEvent.CirclesRequested)
        viewModel.onEvent(HostMapEvent.ViewportChanged(MapViewport(), bounds()))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        assertEquals(UiFailureFallback.HOST_SEARCH, viewModel.state.value.failure?.fallback)

        pendingCircles.complete(Result.success(listOf(circle("retrieved-circle"))))

        assertEquals(listOf(circle("retrieved-circle")), viewModel.state.value.circles)
        assertEquals(UiFailureFallback.HOST_SEARCH, viewModel.state.value.failure?.fallback)
    }

    @Test
    fun placeSubmissionConvertsThrownGeocoderErrorsIntoThePlaceFallback() = withViewModel { viewModel, repository, _ ->
        repository.placeHandler = { _, _ -> throw IOException("Fictional geocoder failure.") }
        viewModel.onEvent(HostMapEvent.LocationQueryChanged("Known fictional place"))

        viewModel.onEvent(HostMapEvent.SubmitPlace)

        assertEquals(UiFailureFallback.PLACE_SEARCH, viewModel.state.value.placeFailure?.fallback)
        assertNull(viewModel.state.value.failure)
        assertEquals(listOf("Known fictional place" to 3, "Known fictional place" to 1), repository.placeQueries)
    }

    @Test
    fun notesVisibilityAuthenticationFailureInvalidatesSessionAndClosesSource() = withViewModel { viewModel, repository, notesConnections ->
        repository.visibleAuthorsHandler = {
            Result.failure(MobileApiException(401, "Fictional session expired."))
        }
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        val connection = notesConnections.connections.single()

        connection.emit(note("private-note", "private-author"))

        assertTrue(viewModel.state.value.pendingSessionInvalidation != null)
        assertEquals(1, connection.closeCalls)
        assertTrue(viewModel.state.value.communityNotes.isEmpty())
    }

    @Test
    fun communityNotesOnlyExposeVisibleAuthorsAndPruneSelectionsWhenVisibilityChanges() = withViewModel { viewModel, repository, notesConnections ->
        repository.visibleAuthors = setOf("visible-author")
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        val connection = notesConnections.connections.single()
        connection.emit(note("hidden-note", "hidden-author"))
        connection.emit(note("visible-note", "visible-author"))

        assertEquals(listOf("visible-note"), viewModel.state.value.communityNotes.map { it.id })
        viewModel.onEvent(HostMapEvent.NotesSelected(viewModel.state.value.communityNotes))
        repository.visibleAuthors = emptySet()
        connection.emit(note("refresh-note", "refresh-author"))

        assertTrue(viewModel.state.value.communityNotes.isEmpty())
        assertTrue(viewModel.state.value.selectedNotes.isEmpty())
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
        viewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        viewModel.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        assertEquals("Repeated enabled-state events keep one live connection", 1, notesConnections.opened)

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
        val searchedBounds = mutableListOf<MapBounds>()
        val searchedFilters = mutableListOf<HostMapFilters>()
        var visibleAuthors: Set<String>? = null
        var visibleAuthorsHandler: ((Set<String>) -> Result<Set<String>>)? = null
        val placeQueries = mutableListOf<Pair<String, Int>>()
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
            searchedBounds += bounds
            searchedFilters += filters
            return searchHandler(searchCalls, bounds, filters)
        }
        override suspend fun circles(): Result<List<TrustrootsCircle>> {
            circleCalls++
            return circleHandler()
        }
        override suspend fun visibleNostrAuthors(authors: Set<String>) =
            visibleAuthorsHandler?.invoke(authors) ?: Result.success(visibleAuthors?.let(authors::intersect) ?: authors)
        override suspend fun places(query: String, maxResults: Int): Result<List<PlaceSuggestion>> {
            placeQueries.add(query to maxResults)
            return placeHandler(query, maxResults)
        }
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
        fun bounds(south: Double = 38.0) = MapBounds(south, -10.0, south + 1.0, -9.0)
        fun circle(id: String) = TrustrootsCircle(id, "circle", "Circle", null, 1, false, null)
        fun note(id: String, author: String = "anonymous-author") = CommunityNote(id, "Anonymous note", 1L, 38.0, -9.0, author)
        fun session(cookie: String) = MemberSession(cookie, MobileMember("anonymous-member", "Anonymous Member"))
    }
}
