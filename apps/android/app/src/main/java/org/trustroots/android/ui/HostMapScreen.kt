package org.trustroots.android.ui

import android.text.Html
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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.TrustrootsCircle
import org.trustroots.android.api.CommunityNote
import org.trustroots.android.api.NostrootsNotesClient
import org.trustroots.android.ui.theme.TrustrootsPaleGreen

@Composable
internal fun HostMapScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onProfileOpenChange: (Boolean) -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
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
    var selectedCircle by remember { mutableStateOf<TrustrootsCircle?>(null) }
    var circles by remember { mutableStateOf<List<TrustrootsCircle>>(emptyList()) }
    var circleMenuOpen by remember { mutableStateOf(false) }
    var mapRevision by remember { mutableIntStateOf(0) }
    val searchGeneration = remember { AtomicInteger() }
    val searchJob = remember { AtomicReference<Job?>() }
    val map = remember(context) {
        Configuration.getInstance().apply {
            osmdroidBasePath = File(context.filesDir, "maps").also { it.mkdirs() }
            osmdroidTileCache = File(context.filesDir, "map-tiles").also { it.mkdirs() }
            userAgentValue = "TrustrootsAndroid/${org.trustroots.android.BuildConfig.VERSION_NAME} (+https://www.trustroots.org)"
            expirationOverrideDuration = 7L * 24 * 60 * 60 * 1000
        }
        MapView(context).apply {
            val mapboxToken = org.trustroots.android.BuildConfig.MAPBOX_PUBLIC_TOKEN
            setTileSource(if (mapboxToken.isNotBlank()) {
                XYTileSource(
                    "Mapbox Streets", 0, 19, 256, ".png?access_token=$mapboxToken",
                    arrayOf("https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/"),
                )
            } else {
                XYTileSource(
                    "OpenStreetMap", 0, 19, 256, ".png",
                    arrayOf("https://tile.openstreetmap.org/"),
                )
            })
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
                selectedCircle?.let { setOf(it.id) } ?: emptySet(),
                seenMonths,
            ).onSuccess {
                if (generation == searchGeneration.get()) offers = it
            }.onFailure {
                if (generation == searchGeneration.get()) {
                    if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                    else error = it.message ?: "Could not search hosts."
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
            val client = NostrootsNotesClient(
                onNote = { note -> scope.launch { receivedNotes[note.id] = note } },
                onError = { scope.launch { noteError = true } },
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
    LaunchedEffect(circleMenuOpen) {
        if (circleMenuOpen && circles.isEmpty()) api.circles(session).onSuccess { circles = it }
    }
    LaunchedEffect(includeHosts, includeMeet, seenMonths, selectedCircle) {
        searchVisibleArea()
    }
    val findLocation: () -> Unit = find@{
        val query = locationQuery.trim()
        if (query.isEmpty()) return@find
        scope.launch {
            error = null
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    Geocoder(context, Locale.getDefault()).getFromLocationName(query, 1)?.firstOrNull()
                }
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
        }
    }
    profileUsername?.let { username ->
        MemberProfileScreen(api, session, username, onSessionInvalidated) { profileUsername = null }
        return
    }
    Box(Modifier.fillMaxSize()) {
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
                                        if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                                        else error = it.message ?: "Could not load host."
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
            modifier = Modifier.fillMaxSize(),
        )
        Column(
            modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(top = 48.dp)
                .testTag("map-controls")
                .background(TrustrootsPaleGreen.copy(alpha = 0.97f)),
        ) {
            OutlinedTextField(
                locationQuery, { locationQuery = it },
                placeholder = { Text("Search place") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { findLocation() }),
                trailingIcon = {
                    TextButton(onClick = findLocation, enabled = locationQuery.isNotBlank()) { Text("Go") }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
            )
            Text(
                if (loading) "Searching this area…" else "${offers.size} offers · ${communityNotes.size} Nostroots notes",
                modifier = Modifier.padding(start = 12.dp),
            )
            if (noteError && includeMeet) Text("Nostroots notes are temporarily unavailable.", color = MaterialTheme.colorScheme.error)
            Row(Modifier.horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically) {
                FilterChip(includeHosts, onClick = { includeHosts = !includeHosts }, label = { Text("Hosting") })
                Spacer(Modifier.width(6.dp))
                FilterChip(includeMeet, onClick = { includeMeet = !includeMeet }, label = { Text("Meet") })
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
                    FilterChip(selectedCircle != null, onClick = { circleMenuOpen = true }, label = { Text(selectedCircle?.label ?: "All circles") })
                    DropdownMenu(expanded = circleMenuOpen, onDismissRequest = { circleMenuOpen = false }) {
                        DropdownMenuItem(text = { Text("All circles") }, onClick = { selectedCircle = null; circleMenuOpen = false })
                        circles.forEach { circle ->
                            DropdownMenuItem(text = { Text(circle.label) }, onClick = { selectedCircle = circle; circleMenuOpen = false })
                        }
                    }
                }
            }
        }
        Text(
            if (org.trustroots.android.BuildConfig.MAPBOX_PUBLIC_TOKEN.isBlank())
                "© OpenStreetMap contributors" else "© Mapbox · © OpenStreetMap contributors",
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.align(Alignment.BottomEnd).padding(bottom = if (host == null) 8.dp else 220.dp, end = 10.dp)
                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)).padding(5.dp),
        )
        error?.let {
            Text(
                it, color = MaterialTheme.colorScheme.error,
                modifier = Modifier.align(Alignment.Center).background(MaterialTheme.colorScheme.surface).padding(12.dp),
            )
        }
        host?.let { selected ->
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    .background(TrustrootsPaleGreen).padding(16.dp),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${if (selectedOfferType == "meet") "Meet" else "Potential host"}: ${selected.user.label}", style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = { host = null }) { Text("Close") }
                }
                selected.status?.let { Text("Hosting: $it") }
                selected.maxGuests?.let { Text("Up to $it guests") }
                selected.description?.let {
                    Text(Html.fromHtml(it, Html.FROM_HTML_MODE_COMPACT).toString().trim(), maxLines = 4)
                }
                selected.user.username?.let { username ->
                    Button(onClick = { profileUsername = username }) { Text("View profile") }
                }
            }
        }
        if (selectedNotes.isNotEmpty()) {
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface).padding(16.dp),
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
    }
}

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
