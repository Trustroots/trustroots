package org.trustroots.android.ui

import androidx.activity.compose.BackHandler
import android.content.Context
import android.location.Address
import android.location.Geocoder
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import android.graphics.drawable.BitmapDrawable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Close
import org.trustroots.android.api.MemberProfile
import androidx.compose.material3.FilterChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.viewinterop.AndroidView
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.Job
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.trustroots.android.api.HostOffer
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.api.CommunityNote
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.ui.theme.TrustrootsPaleGreen
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.common.messageTime
import org.trustroots.android.ui.profile.MemberProfileScreen

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
    onProfileOpenChange: (Boolean) -> Unit = {},
    searchMode: @Composable () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues.Zero,
    geocoderLookup: (Context, String, Int) -> List<Address>? = ::lookupAndroidPlaces,
    notesClientFactory: ((onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> NostrootsNotesClient) =
        { onNote, onError -> NostrootsNotesClient(onNote, onError) },
    mapViewFactory: (Context) -> MapView = { MapView(it) },
) {
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    // MapView animations must resume on Android's UI looper after background lookups.
    val scope = rememberCoroutineScope { Dispatchers.Main.immediate }
    var offers by remember { mutableStateOf<List<MapOffer>>(emptyList()) }
    var host by remember { mutableStateOf<HostOffer?>(null) }
    var selectedNotes by remember { mutableStateOf<List<CommunityNote>>(emptyList()) }
    val receivedNotes = remember { mutableStateMapOf<String, CommunityNote>() }
    var communityNotes by remember { mutableStateOf<List<CommunityNote>>(emptyList()) }
    var noteError by remember { mutableStateOf(false) }
    var selectedOfferType by remember { mutableStateOf("host") }
    var profileUsername by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(profileUsername) { onProfileOpenChange(profileUsername != null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var locationQuery by remember { mutableStateOf("") }
    var includeHosts by remember { mutableStateOf(true) }
    var includeMeet by remember { mutableStateOf(false) }
    var seenMonths by remember { mutableStateOf<Int?>(6) }
    var selectedCircleIDs by remember { mutableStateOf(emptySet<String>()) }
    var selectedLanguages by remember { mutableStateOf(setOf<String>()) }
    var languageMenuOpen by remember { mutableStateOf(false) }
    var circles by remember { mutableStateOf<List<TrustrootsCircle>>(emptyList()) }
    var circleMenuOpen by remember { mutableStateOf(false) }
    var showFilters by remember { mutableStateOf(false) }
    var showSuggestions by remember { mutableStateOf(false) }
    var suggestions by remember { mutableStateOf<List<android.location.Address>>(emptyList()) }
    var selectedProfile by remember { mutableStateOf<MemberProfile?>(null) }
    var memberships by remember { mutableStateOf<Set<String>>(emptySet()) }
    val lookupAddresses: suspend (String, Int) -> List<android.location.Address> = { query, maxResults ->
        withContext(Dispatchers.IO) {
            geocoderLookup(context, query, maxResults).orEmpty()
        }
    }
    LaunchedEffect(host?.id) {
        selectedProfile = null
        host?.user?.username?.let { username ->
            api.profile(session, username).onSuccess { selectedProfile = it }
            api.circleMemberships(session).onSuccess { memberships = it }
        }
    }
    LaunchedEffect(locationQuery, showSuggestions) {
        suggestions = emptyList()
        if (showSuggestions && locationQuery.trim().length >= 3) {
            delay(400)
            suggestions = runCatching { lookupAddresses(locationQuery.trim(), 3) }.getOrDefault(emptyList())
        }
    }
    var mapRevision by remember { mutableIntStateOf(0) }
    BackHandler(
        enabled = profileUsername == null &&
            (showFilters || showSuggestions || host != null || selectedNotes.isNotEmpty()),
    ) {
        when {
            showSuggestions -> { showSuggestions = false; suggestions = emptyList() }
            showFilters -> showFilters = false
            host != null -> host = null
            selectedNotes.isNotEmpty() -> selectedNotes = emptyList()
        }
    }
    val searchGeneration = remember { AtomicInteger() }
    val searchJob = remember { AtomicReference<Job?>() }
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
            setTileSource(hostMapTileSource(org.trustroots.android.BuildConfig.MAPBOX_PUBLIC_TOKEN))
            setBackgroundColor(android.graphics.Color.rgb(236, 249, 245))
            setMultiTouchControls(true)
            controller.setZoom(6.5)
            controller.setCenter(GeoPoint(38.7223, -9.1393))
        }
    }
    val searchVisibleArea: () -> Unit = {
        val types = buildSet {
            if (includeHosts) add("host")
            if (includeMeet) add("meet")
        }
        if (types.isEmpty()) {
            searchJob.getAndSet(null)?.cancel()
            searchGeneration.incrementAndGet()
            offers = emptyList()
            loading = false
        } else {
        val job = scope.launch {
            delay(550)
            if (map.width <= 0 || map.height <= 0) return@launch
            val bounds = map.boundingBox
            val generation = searchGeneration.incrementAndGet()
            loading = true
            error = null
            api.searchOffers(
                session,
                bounds.latSouth.coerceAtLeast(-90.0),
                bounds.lonWest.coerceAtLeast(-180.0),
                bounds.latNorth.coerceAtMost(90.0),
                bounds.lonEast.coerceAtMost(180.0),
                types,
                selectedCircleIDs,
                seenMonths,
                selectedLanguages,
            ).onSuccess {
                if (generation == searchGeneration.get()) offers = it
            }.onFailure {
                if (generation == searchGeneration.get()) {
                    if (it.isAuthenticationFailure()) onSessionInvalidated()
                    else error = it.messageOr("Could not search hosts.")
                }
            }
            if (generation == searchGeneration.get()) loading = false
        }
        searchJob.getAndSet(job)?.cancel()
        }
    }
    val currentSearch = rememberUpdatedState(searchVisibleArea)
    DisposableEffect(includeMeet) {
        if (!includeMeet) {
            receivedNotes.clear()
            communityNotes = emptyList()
            onDispose { }
        } else {
            noteError = false
            val client = notesClientFactory(
                { note -> scope.launch { receivedNotes[note.id] = note } },
                { scope.launch { noteError = true } },
            )
            onDispose { client.close() }
        }
    }
    val incomingNotes = receivedNotes.values.toList()
    LaunchedEffect(incomingNotes, includeMeet) {
        if (!includeMeet || incomingNotes.isEmpty()) return@LaunchedEffect
        delay(250)
        val authors = incomingNotes.map { it.author }.toSet()
        val visible = api.visibleNostrAuthors(session, authors).getOrNull() ?: authors
        communityNotes = incomingNotes.filter { it.author in visible }
    }
    LaunchedEffect(includeHosts, includeMeet, seenMonths, selectedCircleIDs, selectedLanguages) {
        searchVisibleArea()
    }
    val findLocation: () -> Unit = find@{
        val query = locationQuery.trim()
        if (query.isEmpty()) return@find
        showSuggestions = false
        keyboard?.hide()
        focusManager.clearFocus()
        scope.launch {
            error = null
            val result = runCatching {
                lookupAddresses(query, 1).firstOrNull()
            }
            val location = result.getOrNull()
            if (location == null) error = "Could not find that place."
            else {
                map.controller.setZoom(9.0)
                map.controller.animateTo(GeoPoint(location.latitude, location.longitude))
                searchVisibleArea()
            }
        }
    }
    DisposableEffect(map) {
        val listener = object : MapListener {
            override fun onScroll(event: ScrollEvent?): Boolean {
                currentSearch.value()
                return false
            }
            override fun onZoom(event: ZoomEvent?): Boolean {
                mapRevision++
                currentSearch.value()
                return false
            }
        }
        map.addMapListener(listener)
        map.onResume()
        map.post { currentSearch.value() }
        onDispose {
            searchJob.getAndSet(null)?.cancel()
            map.removeMapListener(listener)
            map.onPause()
            map.onDetach()
        }
    }
    profileUsername?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated, onBack = { profileUsername = null }, contentPadding = contentPadding)
        return
    }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val resultCardMaxHeight = maxHeight * 0.5f
        AndroidView(
            factory = { map },
            update = { view ->
                view.overlays.removeAll { it is Marker }
                mapRevision
                val clusters = clusterOffers(offers, view)
                clusters.forEach { cluster ->
                    val offer = cluster.first()
                    val color = when {
                        cluster.size > 1 -> 0xFF12B591.toInt()
                        offer.type == "meet" -> 0xFF11B4DA.toInt()
                        offer.status == "maybe" -> 0xFFF2AE43.toInt()
                        else -> 0xFF58BA58.toInt()
                    }
                    val marker = Marker(view).apply {
                        position = GeoPoint(cluster.map { it.latitude }.average(), cluster.map { it.longitude }.average())
                        title = if (cluster.size > 1) "${cluster.size} offers" else "Potential host"
                        icon = mapMarkerIcon(view, color, if (cluster.size > 1) cluster.size.toString() else null)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        setOnMarkerClickListener { _, _ ->
                            if (cluster.size > 1) {
                                view.controller.setZoom(view.zoomLevelDouble + 2)
                                view.controller.animateTo(position)
                            } else {
                                selectedOfferType = offer.type
                                scope.launch {
                                    api.hostOffer(session, offer.id).onSuccess { host = it }.onFailure {
                                        if (it.isAuthenticationFailure()) onSessionInvalidated()
                                        else error = it.messageOr("Could not load host.")
                                    }
                                }
                            }
                            true
                        }
                    }
                    view.overlays.add(marker)
                }
                val groupedNotes = communityNotes.groupBy { it.latitude to it.longitude }
                val noteOffers = groupedNotes.map { (point, notes) ->
                    MapOffer(notes.first().id, point.first, point.second)
                }
                val notesByID = groupedNotes.values.associateBy { it.first().id }
                clusterOffers(noteOffers, view).forEach { cluster ->
                    val notes = cluster.flatMap { notesByID[it.id].orEmpty() }
                    if (notes.isEmpty()) return@forEach
                    val marker = Marker(view).apply {
                        position = GeoPoint(notes.map { it.latitude }.average(), notes.map { it.longitude }.average())
                        title = if (notes.size == 1) "Community note" else "${notes.size} community notes"
                        icon = mapMarkerIcon(view, 0xFF1565C0.toInt(), if (notes.size > 1) notes.size.toString() else null)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        setOnMarkerClickListener { _, _ ->
                            if (cluster.size > 1 && view.zoomLevelDouble < 14) {
                                view.controller.setZoom(view.zoomLevelDouble + 2)
                                view.controller.animateTo(position)
                            } else selectedNotes = notes.sortedBy { it.createdAt }
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
                .testTag("map-controls").background(Color.White)
                .padding(top = contentPadding.calculateTopPadding()),
        ) {
            Row(Modifier.fillMaxWidth().padding(contentPadding.horizontalInset()).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    locationQuery, { locationQuery = it; showSuggestions = true },
                    placeholder = { Text("Search places") },
                    singleLine = true,
                    leadingIcon = searchMode,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { findLocation() }),
                    trailingIcon = {
                        IconButton(onClick = findLocation, enabled = locationQuery.isNotBlank()) { Icon(Icons.Default.Search, "Search places") }
                    },
                    modifier = Modifier.weight(1f).testTag("placeSearchField"),
                )
                IconButton(onClick = {
                    showSuggestions = false
                    keyboard?.hide()
                    focusManager.clearFocus()
                    showFilters = !showFilters
                    if (showFilters && circles.isEmpty()) scope.launch { api.circles(session).onSuccess { circles = it } }
                }, modifier = Modifier.testTag("openFilters")) {
                    Icon(Icons.Default.FilterList, if (showFilters) "Hide filters" else "Show filters", tint = if (showFilters) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (showSuggestions) suggestions.forEach { address ->
                TextButton(onClick = {
                    locationQuery = address.getAddressLine(0).orEmpty()
                    showSuggestions = false
                    keyboard?.hide()
                    focusManager.clearFocus()
                    map.controller.setZoom(9.0)
                    map.controller.animateTo(GeoPoint(address.latitude, address.longitude))
                    searchVisibleArea()
                }, modifier = Modifier.fillMaxWidth()) { Text(address.getAddressLine(0).orEmpty()) }
            }
            if (showFilters) {
                    Row(
                        Modifier.horizontalScroll(rememberScrollState()).padding(contentPadding.horizontalInset()).padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MultiChoiceSegmentedButtonRow {
                            SegmentedButton(checked = includeHosts, onCheckedChange = { includeHosts = it }, shape = SegmentedButtonDefaults.itemShape(0, 2), label = { Text("Hosting") })
                            SegmentedButton(checked = includeMeet, onCheckedChange = { includeMeet = it }, shape = SegmentedButtonDefaults.itemShape(1, 2), label = { Text("Meet") })
                        }
                        Spacer(Modifier.width(6.dp))
                        FilterChip(
                            selected = seenMonths != null,
                            onClick = { seenMonths = when (seenMonths) { 1 -> 6; 6 -> null; else -> 1 } },
                            label = { Text(when (seenMonths) {
                                1 -> "Last active: 1 month"
                                6 -> "Last active: 6 months"
                                else -> "Last active: any time"
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
                                            0 -> "All circles"
                                            1 -> circles.firstOrNull { it.id in selectedCircleIDs }?.label ?: "1 circle"
                                            else -> "${selectedCircleIDs.size} circles"
                                        },
                                    )
                                },
                            )
                            DropdownMenu(expanded = circleMenuOpen, onDismissRequest = { circleMenuOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text("All circles") },
                                    onClick = { selectedCircleIDs = emptySet(); circleMenuOpen = false },
                                )
                                circles.forEach { circle ->
                                    DropdownMenuItem(
                                        text = { Text("${if (circle.id in selectedCircleIDs) "✓ " else ""}${circle.label}") },
                                        onClick = {
                                            selectedCircleIDs = if (circle.id in selectedCircleIDs) {
                                                selectedCircleIDs - circle.id
                                            } else {
                                                selectedCircleIDs + circle.id
                                            }
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
                                        if (selectedLanguages.isEmpty()) "Spoken languages"
                                        else selectedLanguages.sorted().joinToString { languageName(it) },
                                    )
                                },
                            )
                            DropdownMenu(expanded = languageMenuOpen, onDismissRequest = { languageMenuOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text("Any language") },
                                    onClick = { selectedLanguages = emptySet(); languageMenuOpen = false },
                                )
                                mapFilterLanguages.forEach { code ->
                                    DropdownMenuItem(
                                        text = {
                                            Text("${if (code in selectedLanguages) "✓ " else ""}${languageName(code)}")
                                        },
                                        onClick = {
                                            selectedLanguages = if (code in selectedLanguages) {
                                                selectedLanguages - code
                                            } else {
                                                selectedLanguages + code
                                            }
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
                it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.align(Alignment.Center).background(MaterialTheme.colorScheme.surface).padding(12.dp),
            )
        }
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(contentPadding.horizontalInset()).padding(bottom = contentPadding.calculateBottomPadding()),
        ) {
        host?.let { selected ->
            HostResultCard(
                offer = selected,
                profile = selectedProfile,
                sharedCircleIDs = memberships,
                isMeet = selectedOfferType == "meet",
                api = api,
                session = session,
                maxHeight = resultCardMaxHeight,
                onClose = { host = null },
                onOpenProfile = { selected.user.username?.let { profileUsername = it } },
            )
        }
        if (selectedNotes.isNotEmpty()) {
            Column(
                Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(16.dp),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Community notes via Nostroots", style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { selectedNotes = emptyList() }) { Text("Close") }
                }
                selectedNotes.take(5).forEach { note ->
                    Text(note.content, modifier = Modifier.padding(vertical = 6.dp), maxLines = 4)
                    Text(messageTime(note.createdAt), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        if (noteError && includeMeet) Text("Nostroots notes are temporarily unavailable.", color = MaterialTheme.colorScheme.error, modifier = Modifier.background(MaterialTheme.colorScheme.surface).padding(4.dp))
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)).padding(5.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (loading) "Searching this area…" else "${offers.size} offers · ${communityNotes.count { map.boundingBox.contains(GeoPoint(it.latitude, it.longitude)) }} Nostroots notes in this area",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.weight(1f).testTag("mapStatistics"),
            )
            Text(
                if (org.trustroots.android.BuildConfig.MAPBOX_PUBLIC_TOKEN.isBlank()) "© OpenStreetMap contributors" else "© Mapbox · © OpenStreetMap contributors",
                style = MaterialTheme.typography.labelSmall,
            )
        }
        }
    }
}

internal fun hostMapTileSource(mapboxToken: String): XYTileSource = if (mapboxToken.isNotBlank()) {
    XYTileSource(
        "Mapbox Streets", 0, 19, 256, ".png?access_token=$mapboxToken",
        arrayOf("https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/"),
    )
} else {
    XYTileSource(
        "OpenStreetMap", 0, 19, 256, ".png",
        arrayOf("https://tile.openstreetmap.org/"),
    )
}

private val mapFilterLanguages = listOf(
    "eng", "por", "spa", "fra", "deu", "ita", "nld", "rus", "ara", "zho", "hin", "jpn", "tur", "pol", "swe", "ukr", "fin",
)

internal fun clusterOffers(offers: List<MapOffer>, map: MapView): List<List<MapOffer>> {
    if (map.zoomLevelDouble >= 14) return offers.map(::listOf)
    val cell = (50 * map.resources.displayMetrics.density).toInt().coerceAtLeast(1)
    return offers.groupBy { offer ->
        val point = map.projection.toPixels(GeoPoint(offer.latitude, offer.longitude), Point())
        point.x / cell to point.y / cell
    }.values.flatMap { group -> if (group.size >= 3) listOf(group) else group.map(::listOf) }
}

private fun mapMarkerIcon(map: MapView, color: Int, count: String?): BitmapDrawable {
    val density = map.resources.displayMetrics.density
    val size = (if (count == null) 34 else 50) * density
    val bitmap = Bitmap.createBitmap(size.toInt(), size.toInt(), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val centre = size / 2f
    paint.color = android.graphics.Color.WHITE
    canvas.drawCircle(centre, centre, centre - density, paint)
    paint.color = color
    canvas.drawCircle(centre, centre, centre - 4 * density, paint)
    if (count != null) {
        paint.color = android.graphics.Color.WHITE
        paint.textAlign = Paint.Align.CENTER
        paint.textSize = 17 * density
        paint.typeface = android.graphics.Typeface.DEFAULT_BOLD
        canvas.drawText(count, centre, centre - (paint.ascent() + paint.descent()) / 2, paint)
    }
    return BitmapDrawable(map.resources, bitmap)
}
