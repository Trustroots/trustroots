package org.trustroots.android.ui.hostmap

import android.content.Context
import android.location.Address
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.trustroots.android.api.CommunityNote
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.ui.search.SearchHubScreen

internal data class MapViewport(
    val latitude: Double = 38.7223,
    val longitude: Double = -9.1393,
    val zoom: Double = 6.5,
)

internal data class MapBounds(
    val south: Double,
    val west: Double,
    val north: Double,
    val east: Double,
)

internal data class PlaceSuggestion(
    val label: String,
    val latitude: Double,
    val longitude: Double,
)

internal data class MapViewportCommand(val id: Long, val viewport: MapViewport)

internal interface HostMapRepository {
    fun updateSession(session: MemberSession): Boolean = false
    suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters): Result<List<MapOffer>>
    suspend fun circles(): Result<List<TrustrootsCircle>>
    suspend fun visibleNostrAuthors(authors: Set<String>): Result<Set<String>>
    suspend fun places(query: String, maxResults: Int): Result<List<PlaceSuggestion>>
}

internal fun interface HostMapNotesConnection {
    fun close()
}

private class NostrootsNotesConnection(private val client: NostrootsNotesClient) : HostMapNotesConnection {
    override fun close() = client.close()
}

internal fun createNostrootsNotesConnection(
    onNote: (CommunityNote) -> Unit,
    onError: () -> Unit,
): HostMapNotesConnection = NostrootsNotesConnection(NostrootsNotesClient(onNote, onError))

internal data class HostMapFilters(
    val includeHosts: Boolean = true,
    val includeMeet: Boolean = false,
    val seenMonths: Int? = 6,
    val circleIDs: Set<String> = emptySet(),
    val languages: Set<String> = emptySet(),
)

internal class MobileHostMapRepository(
    private val api: MobileApiClient,
    session: MemberSession,
    private val applicationContext: Context,
    private val geocoderLookup: (Context, String, Int) -> List<Address>? = ::lookupAndroidPlaces,
) : HostMapRepository {
    private var session = session

    override fun updateSession(session: MemberSession): Boolean {
        val changed = this.session.cookieHeader != session.cookieHeader ||
            this.session.member.username != session.member.username
        this.session = session
        return changed
    }

    override suspend fun searchOffers(bounds: MapBounds, filters: HostMapFilters) =
        api.searchOffers(
            session,
            bounds.south,
            bounds.west,
            bounds.north,
            bounds.east,
            buildSet {
                if (filters.includeHosts) add("host")
                if (filters.includeMeet) add("meet")
            },
            filters.circleIDs,
            filters.seenMonths,
            filters.languages,
        )

    override suspend fun circles() = api.circles(session)
    override suspend fun visibleNostrAuthors(authors: Set<String>) = api.visibleNostrAuthors(session, authors)

    override suspend fun places(query: String, maxResults: Int): Result<List<PlaceSuggestion>> =
        withContext(Dispatchers.IO) {
            runCatching {
                geocoderLookup(applicationContext, query, maxResults).orEmpty().mapNotNull { address ->
                    val label = address.getAddressLine(0)?.takeIf(String::isNotBlank) ?: return@mapNotNull null
                    val latitude = address.latitude.takeIf(Double::isFinite) ?: return@mapNotNull null
                    val longitude = address.longitude.takeIf(Double::isFinite) ?: return@mapNotNull null
                    PlaceSuggestion(label, latitude, longitude)
                }
            }
        }
}

internal data class HostMapSessionInvalidation(val id: Long)

internal data class HostMapUiState(
    val offers: List<MapOffer> = emptyList(),
    val selectedNotes: List<CommunityNote> = emptyList(),
    val communityNotes: List<CommunityNote> = emptyList(),
    val noteError: Boolean = false,
    val isLoading: Boolean = false,
    val failure: UiFailure? = null,
    val placeFailure: UiFailure? = null,
    val locationQuery: String = "",
    val suggestions: List<PlaceSuggestion> = emptyList(),
    val filters: HostMapFilters = HostMapFilters(),
    val circles: List<TrustrootsCircle> = emptyList(),
    val viewport: MapViewport = MapViewport(),
    val viewportCommand: MapViewportCommand? = null,
    val measuredBounds: MapBounds? = null,
    val mapVisible: Boolean = false,
    val ownerStarted: Boolean = true,
    val pendingSessionInvalidation: HostMapSessionInvalidation? = null,
)

internal sealed interface HostMapEvent {
    data class MapVisibilityChanged(val visible: Boolean) : HostMapEvent
    data class OwnerLifecycleChanged(val isStarted: Boolean) : HostMapEvent
    data class ViewportChanged(val viewport: MapViewport, val bounds: MapBounds) : HostMapEvent
    data class FiltersChanged(val filters: HostMapFilters) : HostMapEvent
    data class LocationQueryChanged(val value: String) : HostMapEvent
    data class PlaceSelected(val suggestion: PlaceSuggestion) : HostMapEvent
    data object SubmitPlace : HostMapEvent
    data object CirclesRequested : HostMapEvent
    data class NotesSelected(val notes: List<CommunityNote>) : HostMapEvent
    data object NotesDismissed : HostMapEvent
    data object RetrySearch : HostMapEvent
    data class Reset(val generation: Long) : HostMapEvent
    data class SessionInvalidationDelivered(val id: Long) : HostMapEvent
}

internal class HostMapViewModel(
    private val repository: HostMapRepository,
    private val notesClientFactory: ((onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> HostMapNotesConnection) =
        ::createNostrootsNotesConnection,
    scope: CoroutineScope? = null,
    private val wait: suspend (Long) -> Unit = { delay(it) },
) : ViewModel() {
    private val workScope = scope ?: viewModelScope
    private val mutableState = MutableStateFlow(HostMapUiState())
    val state = mutableState.asStateFlow()

    private var searchJob: Job? = null
    private var placeJob: Job? = null
    private var circlesJob: Job? = null
    private var notesFilterJob: Job? = null
    private var notesClient: HostMapNotesConnection? = null
    private val receivedNotes = linkedMapOf<String, CommunityNote>()
    private var searchGeneration = 0L
    private var placeGeneration = 0L
    private var notesGeneration = 0L
    private var nextViewportCommand = 0L
    private var nextInvalidationID = 0L
    private var sessionInvalidationEmitted = false
    private var resetGeneration = -1L
    private var lastSuccessfulSearch: String? = null

    fun onEvent(event: HostMapEvent) {
        when (event) {
            is HostMapEvent.MapVisibilityChanged -> {
                mutableState.update { it.copy(mapVisible = event.visible) }
                reconcileNotesSource()
                if (event.visible) maybeSearch(force = false)
                else cancelSearch()
            }
            is HostMapEvent.OwnerLifecycleChanged -> {
                mutableState.update { it.copy(ownerStarted = event.isStarted) }
                reconcileNotesSource()
                if (!event.isStarted) cancelSearch() else maybeSearch(force = false)
            }
            is HostMapEvent.ViewportChanged -> {
                mutableState.update { it.copy(viewport = event.viewport, measuredBounds = event.bounds) }
                maybeSearch(force = false)
            }
            is HostMapEvent.FiltersChanged -> {
                val includeMeetChanged = state.value.filters.includeMeet != event.filters.includeMeet
                mutableState.update { current ->
                    current.copy(filters = event.filters, communityNotes = if (includeMeetChanged && !event.filters.includeMeet) emptyList() else current.communityNotes,
                        selectedNotes = if (includeMeetChanged && !event.filters.includeMeet) emptyList() else current.selectedNotes)
                }
                if (includeMeetChanged && !event.filters.includeMeet) receivedNotes.clear()
                reconcileNotesSource()
                maybeSearch(force = false)
            }
            is HostMapEvent.LocationQueryChanged -> {
                mutableState.update { it.copy(locationQuery = event.value, placeFailure = null) }
                loadPlaceSuggestions(event.value)
            }
            is HostMapEvent.PlaceSelected -> applyPlace(event.suggestion)
            HostMapEvent.SubmitPlace -> submitPlace()
            HostMapEvent.CirclesRequested -> loadCircles()
            is HostMapEvent.NotesSelected -> mutableState.update { it.copy(selectedNotes = event.notes) }
            HostMapEvent.NotesDismissed -> mutableState.update { it.copy(selectedNotes = emptyList()) }
            HostMapEvent.RetrySearch -> {
                lastSuccessfulSearch = null
                maybeSearch(force = true)
            }
            is HostMapEvent.Reset -> reset(event.generation)
            is HostMapEvent.SessionInvalidationDelivered -> mutableState.update { current ->
                if (current.pendingSessionInvalidation?.id == event.id) current.copy(pendingSessionInvalidation = null) else current
            }
        }
    }

    fun updateSession(session: MemberSession) {
        if (!repository.updateSession(session)) return
        cancelAllWork()
        sessionInvalidationEmitted = false
        resetGeneration = -1L
        receivedNotes.clear()
        lastSuccessfulSearch = null
        mutableState.value = HostMapUiState(
            mapVisible = state.value.mapVisible,
            ownerStarted = state.value.ownerStarted,
        )
        reconcileNotesSource()
        maybeSearch(force = true)
    }

    override fun onCleared() {
        cancelAllWork()
        placeGeneration++
        stopNotesSource(clearNotes = true)
        receivedNotes.clear()
        mutableState.value = HostMapUiState(ownerStarted = false)
        super.onCleared()
    }

    private fun reset(generation: Long) {
        if (generation <= resetGeneration) return
        resetGeneration = generation
        cancelSearch()
        placeJob?.cancel()
        circlesJob?.cancel()
        circlesJob = null
        searchGeneration++
        placeGeneration++
        lastSuccessfulSearch = null
        receivedNotes.clear()
        mutableState.update { current ->
            current.copy(
                offers = emptyList(), selectedNotes = emptyList(), communityNotes = emptyList(),
                noteError = false, isLoading = false, failure = null, placeFailure = null,
                locationQuery = "", suggestions = emptyList(), filters = HostMapFilters(),
                circles = emptyList(), viewport = MapViewport(), measuredBounds = null,
                viewportCommand = MapViewportCommand(++nextViewportCommand, MapViewport()),
            )
        }
        reconcileNotesSource()
    }

    private fun maybeSearch(force: Boolean) {
        val current = state.value
        val bounds = current.measuredBounds ?: return
        if (!current.mapVisible || !current.ownerStarted || sessionInvalidationEmitted) return
        val types = buildSet {
            if (current.filters.includeHosts) add("host")
            if (current.filters.includeMeet) add("meet")
        }
        if (types.isEmpty()) {
            cancelSearch()
            lastSuccessfulSearch = null
            mutableState.update { it.copy(offers = emptyList(), isLoading = false) }
            return
        }
        val fingerprint = listOf(bounds, current.filters.copy(languages = current.filters.languages.toSortedSet(), circleIDs = current.filters.circleIDs.toSortedSet())).joinToString("|")
        if (!force && fingerprint == lastSuccessfulSearch) return
        cancelSearch()
        val generation = ++searchGeneration
        searchJob = workScope.launch {
            wait(550)
            mutableState.update { it.copy(isLoading = true, failure = null) }
            val result = request { repository.searchOffers(bounds, current.filters) }
            if (generation != searchGeneration) return@launch
            result.fold(
                onSuccess = { offers ->
                    lastSuccessfulSearch = fingerprint
                    mutableState.update { it.copy(offers = offers, isLoading = false) }
                },
                onFailure = { error ->
                    handleFailure(error, UiFailureFallback.HOST_SEARCH)
                    mutableState.update { it.copy(isLoading = false) }
                },
            )
        }
    }

    private fun loadPlaceSuggestions(query: String) {
        val generation = ++placeGeneration
        placeJob?.cancel()
        mutableState.update { it.copy(suggestions = emptyList()) }
        if (sessionInvalidationEmitted || query.trim().length < 3) return
        placeJob = workScope.launch {
            wait(400)
            val result = request { repository.places(query.trim(), 3) }
            if (generation != placeGeneration) return@launch
            result.fold(
                onSuccess = { places -> mutableState.update { it.copy(suggestions = places) } },
                onFailure = { error ->
                    if (error.isAuthenticationFailure()) invalidateSession()
                },
            )
        }
    }

    private fun submitPlace() {
        val query = state.value.locationQuery.trim()
        if (sessionInvalidationEmitted || query.isEmpty()) return
        val generation = ++placeGeneration
        placeJob?.cancel()
        mutableState.update { it.copy(suggestions = emptyList(), failure = null, placeFailure = null) }
        placeJob = workScope.launch {
            val result = request { repository.places(query, 1) }
            if (generation != placeGeneration) return@launch
            result.fold(
                onSuccess = { places ->
                    val place = places.firstOrNull()
                    if (place == null) mutableState.update { it.copy(placeFailure = UiFailure(fallback = UiFailureFallback.PLACE_SEARCH)) }
                    else applyPlace(place)
                },
                onFailure = { error -> handleFailure(error, UiFailureFallback.PLACE_SEARCH, place = true) },
            )
        }
    }

    private fun applyPlace(place: PlaceSuggestion) {
        mutableState.update { current ->
            current.copy(
                locationQuery = place.label,
                suggestions = emptyList(),
                failure = null,
                placeFailure = null,
                viewport = MapViewport(place.latitude, place.longitude, 9.0),
                viewportCommand = MapViewportCommand(++nextViewportCommand, MapViewport(place.latitude, place.longitude, 9.0)),
            )
        }
    }

    private fun loadCircles() {
        if (sessionInvalidationEmitted) return
        if (state.value.circles.isNotEmpty() || circlesJob?.isActive == true) return
        circlesJob = workScope.launch {
            request { repository.circles() }.fold(
                onSuccess = { circles -> mutableState.update { it.copy(circles = circles) } },
                onFailure = { handleFailure(it, UiFailureFallback.CIRCLES_LOAD) },
            )
        }
    }

    private fun reconcileNotesSource() {
        val current = state.value
        if (current.filters.includeMeet && current.mapVisible && current.ownerStarted && !sessionInvalidationEmitted) {
            if (notesClient != null) return
            val generation = ++notesGeneration
            mutableState.update { it.copy(noteError = false) }
            notesClient = notesClientFactory(
                { note -> workScope.launch { receiveNote(generation, note) } },
                { workScope.launch { if (generation == notesGeneration) mutableState.update { it.copy(noteError = true) } } },
            )
        } else {
            stopNotesSource(clearNotes = !current.filters.includeMeet)
        }
    }

    private suspend fun receiveNote(generation: Long, note: CommunityNote) {
        if (generation != notesGeneration) return
        receivedNotes[note.id] = note
        notesFilterJob?.cancel()
        notesFilterJob = workScope.launch {
            wait(250)
            val authors = receivedNotes.values.map { it.author }.toSet()
            val visible = request { repository.visibleNostrAuthors(authors) }.getOrElse { error ->
                if (error.isAuthenticationFailure()) handleFailure(error, UiFailureFallback.HOST_SEARCH)
                authors
            }
            if (generation != notesGeneration) return@launch
            val notes = receivedNotes.values.filter { it.author in visible }
            mutableState.update { it.copy(communityNotes = notes, selectedNotes = it.selectedNotes.filter { item -> notes.any { item.id == it.id } }) }
        }
    }

    private fun stopNotesSource(clearNotes: Boolean) {
        notesGeneration++
        notesClient?.close()
        notesClient = null
        notesFilterJob?.cancel()
        if (clearNotes) {
            receivedNotes.clear()
            mutableState.update { it.copy(communityNotes = emptyList(), selectedNotes = emptyList(), noteError = false) }
        }
    }

    private fun handleFailure(error: Throwable, fallback: UiFailureFallback, place: Boolean = false) {
        if (error.isAuthenticationFailure()) invalidateSession()
        else mutableState.update { current ->
            if (place) current.copy(placeFailure = error.toUiFailure(fallback))
            else current.copy(failure = error.toUiFailure(fallback))
        }
    }

    private fun invalidateSession() {
        if (sessionInvalidationEmitted) return
        sessionInvalidationEmitted = true
        cancelSearch()
        val invalidation = HostMapSessionInvalidation(++nextInvalidationID)
        mutableState.update { it.copy(pendingSessionInvalidation = invalidation, isLoading = false) }
        reconcileNotesSource()
    }

    private fun cancelSearch() {
        searchGeneration++
        searchJob?.cancel()
        searchJob = null
        mutableState.update { if (it.isLoading) it.copy(isLoading = false) else it }
    }

    private fun cancelAllWork() {
        cancelSearch()
        placeJob?.cancel()
        circlesJob?.cancel()
        notesFilterJob?.cancel()
        placeJob = null
        circlesJob = null
    }

    private suspend fun <T> request(operation: suspend () -> Result<T>): Result<T> {
        val result = try {
            operation()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            Result.failure(error)
        }
        coroutineContext.ensureActive()
        (result.exceptionOrNull() as? CancellationException)?.let { throw it }
        return result
    }

    class Factory(
        private val repository: HostMapRepository,
        private val notesClientFactory: ((onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> HostMapNotesConnection),
        private val scope: CoroutineScope? = null,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(HostMapViewModel::class.java))
            return HostMapViewModel(repository, notesClientFactory, scope) as T
        }
    }
}

@Composable
internal fun rememberHostMapViewModel(
    api: MobileApiClient,
    session: MemberSession,
    geocoderLookup: (Context, String, Int) -> List<Address>? = ::lookupAndroidPlaces,
    notesClientFactory: ((onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> HostMapNotesConnection) =
        ::createNostrootsNotesConnection,
): HostMapViewModel {
    val owner = checkNotNull(LocalViewModelStoreOwner.current) {
        "SearchHubScreen must be hosted by a Navigation 3 entry ViewModelStoreOwner"
    }
    val applicationContext = LocalContext.current.applicationContext
    val repository = remember(owner, api, session.member.username, geocoderLookup) {
        MobileHostMapRepository(api, session, applicationContext, geocoderLookup)
    }
    val sourceFactory: (onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> HostMapNotesConnection =
        remember(notesClientFactory) { notesClientFactory }
    val factory = remember(owner, repository, sourceFactory) {
        HostMapViewModel.Factory(repository, sourceFactory)
    }
    val viewModel = remember(owner, factory) {
        ViewModelProvider(owner, factory).get(HostMapViewModel::class.java)
    }
    androidx.compose.runtime.SideEffect { viewModel.updateSession(session) }
    return viewModel
}
