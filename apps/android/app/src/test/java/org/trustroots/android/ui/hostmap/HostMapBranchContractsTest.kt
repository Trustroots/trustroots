package org.trustroots.android.ui.hostmap

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
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.TrustrootsCircle

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
class HostMapBranchContractsTest {
    @Test
    fun uncancellableOldSearchSuccessCannotPopulateTheReplacementSession() = withViewModel { model, repository, _ ->
        val oldSearch = CompletableDeferred<Result<List<MapOffer>>>()
        repository.searchHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldSearch.await() }
            else Result.success(listOf(MapOffer("new-session-result", 1.0, 2.0)))
        }
        model.onEvent(HostMapEvent.ViewportChanged(MapViewport(), bounds()))
        model.onEvent(HostMapEvent.MapVisibilityChanged(true))
        assertEquals(1, repository.searchCalls)

        model.updateSession(session("replacement-cookie"))
        oldSearch.complete(Result.success(listOf(MapOffer("old-session-result", 3.0, 4.0))))

        assertTrue(model.state.value.offers.isEmpty())
        assertNull(model.state.value.pendingSessionInvalidation)
        assertNull(model.state.value.failure)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun uncancellableOldSearchAuthenticationFailureCannotInvalidateTheReplacementSession() = withViewModel { model, repository, _ ->
        val oldSearch = CompletableDeferred<Result<List<MapOffer>>>()
        repository.searchHandler = { call ->
            if (call == 1) withContext(NonCancellable) { oldSearch.await() }
            else Result.success(emptyList())
        }
        model.onEvent(HostMapEvent.ViewportChanged(MapViewport(), bounds()))
        model.onEvent(HostMapEvent.MapVisibilityChanged(true))
        model.updateSession(session("replacement-cookie"))

        oldSearch.complete(Result.failure(MobileApiException(401, "Expired")))

        assertNull(model.state.value.pendingSessionInvalidation)
        assertNull(model.state.value.failure)
        assertFalse(model.state.value.isLoading)
    }

    @Test
    fun callbacksFromThePreviousAccountCannotEmitNotesOrErrors() = withViewModel { model, _, notes ->
        model.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        model.onEvent(HostMapEvent.MapVisibilityChanged(true))
        val oldConnection = notes.connections.single()

        model.updateSession(session("replacement-cookie"))
        oldConnection.emit(CommunityNote("old-note", "Anonymous note", 1L, 1.0, 2.0, "anonymous-author"))
        oldConnection.fail()

        assertEquals(1, oldConnection.closeCalls)
        assertTrue(model.state.value.communityNotes.isEmpty())
        assertFalse(model.state.value.noteError)
        assertNull(model.state.value.pendingSessionInvalidation)
        assertFalse(model.state.value.filters.includeMeet)
        assertEquals(1, notes.connections.size)

        model.onEvent(HostMapEvent.FiltersChanged(HostMapFilters(includeMeet = true)))
        assertEquals(2, notes.connections.size)
        notes.connections.last().emit(
            CommunityNote("current-note", "A current note", 2L, 1.0, 2.0, "current-author"),
        )
        assertEquals(listOf("current-note"), model.state.value.communityNotes.map { it.id })
    }

    private fun withViewModel(
        test: (HostMapViewModel, FakeRepository, FakeNotes) -> Unit,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val repository = FakeRepository()
        val notes = FakeNotes()
        try {
            val model = HostMapViewModel(
                repository = repository,
                notesClientFactory = { onNote, onError -> notes.open(onNote, onError) },
                scope = scope,
                wait = {},
            )
            test(model, repository, notes)
        } finally {
            scope.cancel()
        }
    }

    private class FakeRepository : HostMapRepository {
        var searchCalls = 0
        var searchHandler: suspend (Int) -> Result<List<MapOffer>> = { Result.success(emptyList()) }

        override fun updateSession(session: MemberSession) = true
        override suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters): Result<List<MapOffer>> =
            searchHandler(++searchCalls)
        override suspend fun circles(): Result<List<TrustrootsCircle>> = Result.success(emptyList())
        override suspend fun visibleNostrAuthors(authors: Set<String>): Result<Set<String>> = Result.success(authors)
        override suspend fun places(query: String, maxResults: Int): Result<List<PlaceSuggestion>> = Result.success(emptyList())
    }

    private class FakeNotes {
        val connections = mutableListOf<FakeConnection>()

        fun open(onNote: (CommunityNote) -> Unit, onError: () -> Unit): HostMapNotesConnection =
            FakeConnection(onNote, onError).also(connections::add)
    }

    private class FakeConnection(
        private val onNote: (CommunityNote) -> Unit,
        private val onError: () -> Unit,
    ) : HostMapNotesConnection {
        var closeCalls = 0
        override fun close() { closeCalls++ }
        fun emit(note: CommunityNote) = onNote(note)
        fun fail() = onError()
    }

    private companion object {
        fun bounds() = MapBounds(0.0, 0.0, 1.0, 1.0)
        fun session(cookie: String) = MemberSession(cookie, MobileMember("anonymous-member", "Anonymous Member"))
    }
}
