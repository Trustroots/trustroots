package org.trustroots.android.ui.hostmap

import androidx.activity.compose.BackHandler
import android.content.Context
import android.location.Address
import android.location.Geocoder
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import android.graphics.drawable.BitmapDrawable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MultiChoiceSegmentedButtonRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.FilterChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import org.trustroots.android.ui.common.SubmittedSearchField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import java.io.File
import java.util.Locale
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.R
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.CommunityNote
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.common.mapStatisticsLabel
import org.trustroots.android.ui.common.messageTime

internal fun lookupAndroidPlaces(
    context: Context,
    query: String,
    maxResults: Int,
): List<Address>? = Geocoder(context, Locale.getDefault()).getFromLocationName(query, maxResults)

@Composable
internal fun HostMapScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    viewModel: HostMapViewModel? = null,
    onOpenHostDetail: (MapOffer) -> Unit = {},
    searchModeMenu: @Composable () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues.Zero,
    geocoderLookup: (Context, String, Int) -> List<Address>? = ::lookupAndroidPlaces,
    notesClientFactory: ((onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> HostMapNotesConnection) =
        ::createNostrootsNotesConnection,
    mapViewFactory: (Context) -> MapView = { MapView(it) },
) {
    val context = LocalContext.current
    val mapViewModel = viewModel ?: rememberHostMapViewModel(
        api = api,
        session = session,
        geocoderLookup = geocoderLookup,
        notesClientFactory = notesClientFactory,
    )
    val mapState by mapViewModel.state.collectAsState()
    DisposableEffect(mapViewModel) {
        mapViewModel.onEvent(HostMapEvent.MapVisibilityChanged(true))
        onDispose { mapViewModel.onEvent(HostMapEvent.MapVisibilityChanged(false)) }
    }
    val resources = LocalResources.current
    val languageLocale = LocalConfiguration.current.locales[0]
    val appContext = LocalContext.current.applicationContext
    val mapBackground = colorResource(R.color.trustroots_pale_green)
    val potentialHostLabel = stringResource(R.string.screen_potential_host)
    val communityNoteLabel = stringResource(R.string.screen_community_note)
    val hideFiltersLabel = stringResource(R.string.screen_hide_filters)
    val showFiltersLabel = stringResource(R.string.screen_show_filters)
    val hostingLabel = stringResource(R.string.screen_hosting)
    val meetLabel = stringResource(R.string.screen_meet)
    val lastActiveOneMonth = stringResource(R.string.screen_last_active_one_month)
    val lastActiveSixMonths = stringResource(R.string.screen_last_active_six_months)
    val lastActiveAnyTime = stringResource(R.string.screen_last_active_any_time)
    val allCirclesLabel = stringResource(R.string.screen_all_circles)
    val oneCircleLabel = stringResource(R.string.screen_one_circle)
    val spokenLanguagesLabel = stringResource(R.string.screen_spoken_languages)
    val anyLanguageLabel = stringResource(R.string.screen_any_language)
    val notesHeading = stringResource(R.string.screen_community_notes_via_nostroots)
    val closeLabel = stringResource(R.string.screen_close)
    val notesUnavailable = stringResource(R.string.screen_nostroots_notes_unavailable)
    val searchingArea = stringResource(R.string.screen_searching_area)
    val tiles = remember { hostMapTiles(org.trustroots.android.BuildConfig.MAPBOX_PUBLIC_TOKEN) }
    val attribution = stringResource(tiles.attribution)
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    val offers = mapState.offers
    val selectedNotes = mapState.selectedNotes
    val communityNotes = mapState.communityNotes
    val noteError = mapState.noteError
    val loading = mapState.isLoading
    val error = mapState.failure ?: mapState.placeFailure
    val locationQuery = mapState.locationQuery
    val includeHosts = mapState.filters.includeHosts
    val includeMeet = mapState.filters.includeMeet
    val seenMonths = mapState.filters.seenMonths
    val selectedCircleIDs = mapState.filters.circleIDs
    val selectedLanguages = mapState.filters.languages
    var languageMenuOpen by remember { mutableStateOf(false) }
    val circles = mapState.circles
    var circleMenuOpen by remember { mutableStateOf(false) }
    var showFilters by remember { mutableStateOf(false) }
    var showSuggestions by remember { mutableStateOf(false) }
    val suggestions = mapState.suggestions
    var mapRevision by remember { mutableIntStateOf(0) }
    BackHandler(
        enabled = showFilters || showSuggestions || selectedNotes.isNotEmpty(),
    ) {
        when {
            showSuggestions -> showSuggestions = false
            showFilters -> showFilters = false
            selectedNotes.isNotEmpty() -> mapViewModel.onEvent(HostMapEvent.NotesDismissed)
        }
    }
    val map = remember(context) {
        Configuration.getInstance().apply {
            osmdroidBasePath = File(context.filesDir, "maps").also { it.mkdirs() }
            osmdroidTileCache = File(context.filesDir, "map-tiles").also { it.mkdirs() }
            userAgentValue = "TrustrootsAndroid/${org.trustroots.android.BuildConfig.VERSION_NAME} (+https://www.trustroots.org)"
            expirationOverrideDuration = 7L * 24 * 60 * 60 * 1000
        }
        mapViewFactory(context).apply {
            // The AndroidView holder below can be detached and re-attached (e.g. when navigating
            // to a host detail and back). With the default destroy mode, MapView.onDetachedFromWindow()
            // calls onDetach(), invalidating MapViewRepository (getRepository() then dereferences a
            // null MapView when building the default MarkerInfoWindow -> NPE on re-attach).
            setDestroyMode(false)
            setTileSource(tiles.source)
            setBackgroundColor(mapBackground.toArgb())
            setMultiTouchControls(true)
            controller.setZoom(mapState.viewport.zoom)
            controller.setCenter(GeoPoint(mapState.viewport.latitude, mapState.viewport.longitude))
        }
    }
    val dispatchViewport: () -> Unit = dispatch@{
        if (map.width <= 0 || map.height <= 0) return@dispatch
        val centre = map.mapCenter
        val bounds = map.boundingBox
        mapViewModel.onEvent(
            HostMapEvent.ViewportChanged(
                MapViewport(centre.latitude, centre.longitude, map.zoomLevelDouble),
                MapBounds(
                    bounds.latSouth.coerceAtLeast(-90.0),
                    bounds.lonWest.coerceAtLeast(-180.0),
                    bounds.latNorth.coerceAtMost(90.0),
                    bounds.lonEast.coerceAtMost(180.0),
                ),
            ),
        )
    }
    LaunchedEffect(mapState.viewportCommand?.id) {
        mapState.viewportCommand?.viewport?.let { viewport ->
            map.controller.setZoom(viewport.zoom)
            map.controller.animateTo(GeoPoint(viewport.latitude, viewport.longitude))
            map.post { dispatchViewport() }
        }
    }
    LaunchedEffect(mapState.pendingSessionInvalidation?.id) {
        val pending = mapState.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        mapViewModel.onEvent(HostMapEvent.SessionInvalidationDelivered(pending.id))
    }
    val findLocation: () -> Unit = {
        showSuggestions = false
        keyboard?.hide()
        focusManager.clearFocus()
        mapViewModel.onEvent(HostMapEvent.SubmitPlace)
    }
    DisposableEffect(map) {
        val listener = object : MapListener {
            override fun onScroll(event: ScrollEvent?): Boolean {
                dispatchViewport()
                return false
            }
            override fun onZoom(event: ZoomEvent?): Boolean {
                mapRevision++
                dispatchViewport()
                return false
            }
        }
        map.addMapListener(listener)
        map.onResume()
        map.post { dispatchViewport() }
        onDispose {
            map.removeMapListener(listener)
            map.onPause()
            map.onDetach()
        }
    }
    Box(Modifier.fillMaxSize()) {
        AndroidView(
            factory = { map },
            update = { view ->
                view.setBackgroundColor(mapBackground.toArgb())
                view.overlays.removeAll { it is Marker }
                mapRevision
                val clusters = clusterOffers(offers, view)
                clusters.forEach { cluster ->
                    val offer = cluster.first()
                    val colorResource = when {
                        cluster.size > 1 -> R.color.map_marker_cluster
                        offer.type == "meet" -> R.color.map_marker_meet
                        offer.status == "maybe" -> R.color.map_marker_maybe
                        else -> R.color.map_marker_host
                    }
                    val marker = Marker(view).apply {
                        position = GeoPoint(cluster.map { it.latitude }.average(), cluster.map { it.longitude }.average())
                        title = if (cluster.size > 1) resources.getQuantityString(R.plurals.screen_offers_count, cluster.size, cluster.size) else potentialHostLabel
                        icon = mapMarkerIcon(view, colorResource, if (cluster.size > 1) cluster.size.toString() else null)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        setOnMarkerClickListener { _, _ ->
                            if (cluster.size > 1) {
                                view.controller.setZoom(view.zoomLevelDouble + 2)
                                view.controller.animateTo(position)
                            } else {
                                onOpenHostDetail(offer)
                            }
                            true
                        }
                    }
                    view.overlays.add(marker)
                }
                val groupedNotes = communityNotes.groupBy { it.latitude to it.longitude }
                clusterMapItems(groupedNotes.entries.toList(), view) {
                    GeoPoint(it.key.first, it.key.second)
                }.forEach { cluster ->
                    val notes = cluster.flatMap { it.value }
                    val marker = Marker(view).apply {
                        position = GeoPoint(notes.map { it.latitude }.average(), notes.map { it.longitude }.average())
                        title = if (notes.size == 1) communityNoteLabel else resources.getQuantityString(R.plurals.screen_community_notes_count, notes.size, notes.size)
                        icon = mapMarkerIcon(view, R.color.map_marker_community_note, if (notes.size > 1) notes.size.toString() else null)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        setOnMarkerClickListener { _, _ ->
                            if (cluster.size > 1 && view.zoomLevelDouble < 14) {
                                view.controller.setZoom(view.zoomLevelDouble + 2)
                                view.controller.animateTo(position)
                            } else mapViewModel.onEvent(HostMapEvent.NotesSelected(notes.sortedBy { it.createdAt }))
                            true
                        }
                    }
                    view.overlays.add(marker)
                }
                view.invalidate()
            },
            modifier = Modifier.fillMaxSize().testTag("hostMapView"),
        )
        Column(
            modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth()
                .testTag("map-controls").background(MaterialTheme.colorScheme.surface)
                .padding(top = contentPadding.calculateTopPadding()),
        ) {
            Row(Modifier.fillMaxWidth().padding(contentPadding.horizontalInset()).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                SubmittedSearchField(
                    value = locationQuery,
                    onValueChange = {
                        mapViewModel.onEvent(HostMapEvent.LocationQueryChanged(it))
                        showSuggestions = it.isNotEmpty()
                    },
                    label = stringResource(R.string.search_places),
                    clearLabel = stringResource(R.string.clear_place_search),
                    searchLabel = stringResource(R.string.search_places),
                    leadingIcon = searchModeMenu,
                    onSearch = findLocation,
                    searchEnabled = locationQuery.isNotBlank(),
                    modifier = Modifier.weight(1f).testTag("placeSearchField"),
                )
                IconButton(onClick = {
                    showSuggestions = false
                    keyboard?.hide()
                    focusManager.clearFocus()
                    showFilters = !showFilters
                    if (showFilters && circles.isEmpty()) mapViewModel.onEvent(HostMapEvent.CirclesRequested)
                }, modifier = Modifier.testTag("openFilters")) {
                    Icon(Icons.Default.FilterList, if (showFilters) hideFiltersLabel else showFiltersLabel, tint = if (showFilters) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (showSuggestions) suggestions.forEach { suggestion ->
                TextButton(onClick = {
                    showSuggestions = false
                    keyboard?.hide()
                    focusManager.clearFocus()
                    mapViewModel.onEvent(HostMapEvent.PlaceSelected(suggestion))
                }, modifier = Modifier.fillMaxWidth()) { Text(suggestion.label) }
            }
            if (showFilters) {
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()).padding(contentPadding.horizontalInset()).padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MultiChoiceSegmentedButtonRow {
                            SegmentedButton(checked = includeHosts, onCheckedChange = { mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(includeHosts = it))) }, shape = SegmentedButtonDefaults.itemShape(0, 2), label = { Text(hostingLabel) })
                            SegmentedButton(checked = includeMeet, onCheckedChange = { mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(includeMeet = it))) }, shape = SegmentedButtonDefaults.itemShape(1, 2), label = { Text(meetLabel) })
                        }
                        Spacer(Modifier.width(6.dp))
                        FilterChip(
                            selected = seenMonths != null,
                            onClick = { mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(seenMonths = when (seenMonths) { 1 -> 6; 6 -> null; else -> 1 }))) },
                            label = { Text(when (seenMonths) {
                                1 -> lastActiveOneMonth
                                6 -> lastActiveSixMonths
                                else -> lastActiveAnyTime
                            }) },
                        )
                        Spacer(Modifier.width(6.dp))
                        Box {
                            FilterChip(
                                selectedCircleIDs.isNotEmpty(),
                                onClick = { circleMenuOpen = true },
                                trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                                label = {
                                    Text(
                                        when (selectedCircleIDs.size) {
                                            0 -> allCirclesLabel
                                            1 -> circles.firstOrNull { it.id in selectedCircleIDs }?.label ?: oneCircleLabel
                                            else -> pluralStringResource(
                                                R.plurals.screen_circles_count,
                                                selectedCircleIDs.size,
                                                selectedCircleIDs.size,
                                            )
                                        },
                                    )
                                },
                            )
                            DropdownMenu(expanded = circleMenuOpen, onDismissRequest = { circleMenuOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text(allCirclesLabel) },
                                    modifier = Modifier
                                        .testTag("circleFilterOption-all")
                                        .semantics { selected = selectedCircleIDs.isEmpty() },
                                    trailingIcon = {
                                        if (selectedCircleIDs.isEmpty()) Icon(Icons.Default.Check, contentDescription = null)
                                    },
                                    onClick = { mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(circleIDs = emptySet()))); circleMenuOpen = false },
                                )
                                circles.forEach { circle ->
                                    DropdownMenuItem(
                                        text = { Text(circle.label) },
                                        modifier = Modifier
                                            .testTag("circleFilterOption-${circle.id}")
                                            .semantics { selected = circle.id in selectedCircleIDs },
                                        trailingIcon = {
                                            if (circle.id in selectedCircleIDs) Icon(Icons.Default.Check, contentDescription = null)
                                        },
                                        onClick = {
                                            mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(circleIDs = if (circle.id in selectedCircleIDs) selectedCircleIDs - circle.id else selectedCircleIDs + circle.id)))
                                        },
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.width(6.dp))
                        Box {
                            FilterChip(
                                selectedLanguages.isNotEmpty(),
                                onClick = { languageMenuOpen = true },
                                trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                                label = {
                                    Text(
                                        if (selectedLanguages.isEmpty()) spokenLanguagesLabel
                                        else selectedLanguages.sorted().joinToString { languageName(appContext, it, languageLocale) },
                                    )
                                },
                            )
                            DropdownMenu(expanded = languageMenuOpen, onDismissRequest = { languageMenuOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text(anyLanguageLabel) },
                                    modifier = Modifier
                                        .testTag("languageFilterOption-any")
                                        .semantics { selected = selectedLanguages.isEmpty() },
                                    trailingIcon = {
                                        if (selectedLanguages.isEmpty()) Icon(Icons.Default.Check, contentDescription = null)
                                    },
                                    onClick = { mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(languages = emptySet()))); languageMenuOpen = false },
                                )
                                mapFilterLanguages.forEach { code ->
                                    DropdownMenuItem(
                                        text = {
                                            Text(languageName(appContext, code, languageLocale))
                                        },
                                        modifier = Modifier
                                            .testTag("languageFilterOption-$code")
                                            .semantics { selected = code in selectedLanguages },
                                        trailingIcon = {
                                            if (code in selectedLanguages) Icon(Icons.Default.Check, contentDescription = null)
                                        },
                                        onClick = {
                                            mapViewModel.onEvent(HostMapEvent.FiltersChanged(mapState.filters.copy(languages = if (code in selectedLanguages) selectedLanguages - code else selectedLanguages + code)))
                                        },
                                    )
                                }
                            }
                        }
                    }
            }
        }
        error?.let {
            Text(
                resolveFailureMessage(it), color = MaterialTheme.colorScheme.error,
                modifier = Modifier.align(Alignment.Center).background(MaterialTheme.colorScheme.surface).padding(12.dp),
            )
        }
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(contentPadding.horizontalInset()).padding(bottom = contentPadding.calculateBottomPadding()),
        ) {
        if (selectedNotes.isNotEmpty()) {
            Column(
                Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(notesHeading, style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { mapViewModel.onEvent(HostMapEvent.NotesDismissed) }) { Text(closeLabel) }
                }
                selectedNotes.take(5).forEach { note ->
                    Text(note.content, modifier = Modifier.padding(vertical = 6.dp), maxLines = 4)
                    Text(messageTime(context.resources, note.createdAt), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        if (noteError && includeMeet) Text(notesUnavailable, color = MaterialTheme.colorScheme.error, modifier = Modifier.background(MaterialTheme.colorScheme.surface).padding(4.dp))
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)).padding(5.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (loading) searchingArea else mapStatisticsLabel(
                    offers.size,
                    communityNotes.count { map.boundingBox.contains(GeoPoint(it.latitude, it.longitude)) },
                ),
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.weight(1f).testTag("mapStatistics"),
            )
            Text(
                attribution,
                style = MaterialTheme.typography.labelSmall,
            )
        }
        }
    }
}

private val mapFilterLanguages = listOf(
    "eng", "por", "spa", "fra", "deu", "ita", "nld", "rus", "ara", "zho", "hin", "jpn", "tur", "pol", "swe", "ukr", "fin",
)

internal fun clusterOffers(offers: List<MapOffer>, map: MapView): List<List<MapOffer>> {
    return clusterMapItems(offers, map) { GeoPoint(it.latitude, it.longitude) }
}

private fun <T> clusterMapItems(items: List<T>, map: MapView, location: (T) -> GeoPoint): List<List<T>> {
    if (map.zoomLevelDouble >= 14) return items.map(::listOf)
    val cell = (50 * map.resources.displayMetrics.density).toInt().coerceAtLeast(1)
    return items.groupBy { item ->
        val point = map.projection.toPixels(location(item), Point())
        point.x / cell to point.y / cell
    }.values.flatMap { group -> if (group.size >= 3) listOf(group) else group.map(::listOf) }
}

private fun mapMarkerIcon(map: MapView, colorResource: Int, count: String?): BitmapDrawable {
    val density = map.resources.displayMetrics.density
    val size = (if (count == null) 34 else 50) * density
    val bitmap = Bitmap.createBitmap(size.toInt(), size.toInt(), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val centre = size / 2f
    paint.color = map.resources.getColor(R.color.map_marker_white, map.context.theme)
    canvas.drawCircle(centre, centre, centre - density, paint)
    paint.color = map.resources.getColor(colorResource, map.context.theme)
    canvas.drawCircle(centre, centre, centre - 4 * density, paint)
    if (count != null) {
        paint.color = map.resources.getColor(R.color.map_marker_white, map.context.theme)
        paint.textAlign = Paint.Align.CENTER
        paint.textSize = 17 * density
        paint.typeface = android.graphics.Typeface.DEFAULT_BOLD
        canvas.drawText(count, centre, centre - (paint.ascent() + paint.descent()) / 2, paint)
    }
    return BitmapDrawable(map.resources, bitmap)
}
