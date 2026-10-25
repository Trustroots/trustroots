package org.trustroots.android.ui.search

import android.content.Context
import android.location.Address
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.scene.SinglePaneSceneStrategy
import androidx.navigation3.ui.NavDisplay
import org.osmdroid.views.MapView
import org.trustroots.android.R
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.CommunityNote
import org.trustroots.android.api.MapOffer
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.DefaultBrowserContent
import org.trustroots.android.ui.hostdetail.HostDetailScreen
import org.trustroots.android.ui.hostmap.HostMapEvent
import org.trustroots.android.ui.hostmap.HostMapNotesConnection
import org.trustroots.android.ui.hostmap.HostMapScreen
import org.trustroots.android.ui.hostmap.createNostrootsNotesConnection
import org.trustroots.android.ui.hostmap.lookupAndroidPlaces
import org.trustroots.android.ui.hostmap.rememberHostMapViewModel
import org.trustroots.android.ui.membersearch.MemberSearchEvent
import org.trustroots.android.ui.membersearch.MemberSearchScreen
import org.trustroots.android.ui.membersearch.rememberMemberSearchViewModel
import org.trustroots.android.ui.profile.MemberProfileScreen

@Composable
internal fun SearchModeMenu(tab: Int, onSelect: (Int) -> Unit) {
    val searchMode = stringResource(R.string.screen_search_mode)
    val hostsMap = stringResource(R.string.screen_search_hosts_map)
    val members = stringResource(R.string.screen_search_members)
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (tab == 0) Icons.Default.Place else Icons.Default.PersonSearch, searchMode)
                Icon(Icons.Default.ArrowDropDown, null)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            listOf(hostsMap, members).forEachIndexed { index, label ->
                DropdownMenuItem(
                    text = { Text(label) },
                    leadingIcon = { Icon(if (index == 0) Icons.Default.Place else Icons.Default.PersonSearch, null) },
                    onClick = { expanded = false; onSelect(index) },
                )
            }
        }
    }
}

@Composable
internal fun SearchHubScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    initialTab: Int = 0,
    contentPadding: PaddingValues = PaddingValues.Zero,
    resetGeneration: Int = 0,
    resetVisitID: Long = -1L,
    ownerVisitID: Long = -1L,
    isActiveTabVisit: Boolean = true,
    onCurrentUsageScreen: (Long, UsageScreen?) -> Unit = { _, _ -> },
    onBackAtRoot: () -> Unit = {},
    geocoderLookup: (Context, String, Int) -> List<Address>? = ::lookupAndroidPlaces,
    notesClientFactory: ((onNote: (CommunityNote) -> Unit, onError: () -> Unit) -> HostMapNotesConnection) =
        ::createNostrootsNotesConnection,
    mapViewFactory: (Context) -> MapView = { MapView(it) },
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = DefaultBrowserContent,
) {
    val memberSearchViewModel = rememberMemberSearchViewModel(api, session)
    val hostMapViewModel = rememberHostMapViewModel(
        api, session, geocoderLookup = geocoderLookup, notesClientFactory = notesClientFactory,
    )
    val entryInitialTab = rememberSaveable { initialTab }
    var mapResetGeneration by rememberSaveable { mutableIntStateOf(0) }
    var appliedResetGeneration by rememberSaveable { mutableIntStateOf(0) }
    val searchBackStack = rememberNavBackStack(
        SearchHomeVisit(ownerVisitID),
        SearchModeVisit(modeFor(initialTab), ownerVisitID + 1L),
    )
    var nextRouteID by rememberSaveable(ownerVisitID) { mutableLongStateOf(ownerVisitID + 2L) }
    val currentRoute = searchBackStack.lastOrNull()
    val isProfileOpen = currentRoute is SearchMemberProfileVisit
    val currentMode = (currentRoute as? SearchModeVisit)?.mode ?: modeFor(entryInitialTab)
    val pushProfile: (String) -> Unit = { username ->
        // The profile replaces the host preview, so its overlay cannot cover
        // the profile or intercept its close and back actions.
        if (searchBackStack.lastOrNull() is HostDetailVisit) searchBackStack.removeLastOrNull()
        searchBackStack.add(SearchMemberProfileVisit(username, nextRouteID++))
    }
    val pushHostDetail: (MapOffer) -> Unit = { offer ->
        searchBackStack.add(
            HostDetailVisit(
                offerID = offer.id,
                offerType = if (offer.type == "meet") SearchOfferType.Meet else SearchOfferType.Host,
                visitID = nextRouteID++,
            ),
        )
    }
    val selectMode: (Int) -> Unit = { tab ->
        val mode = modeFor(tab)
        if (currentMode != mode) {
            if (searchBackStack.lastOrNull() is SearchModeVisit) searchBackStack.removeLastOrNull()
            searchBackStack.add(SearchModeVisit(mode, nextRouteID++))
        }
    }
    val popRoute: () -> Unit = {
        if (searchBackStack.size > 2) searchBackStack.removeLastOrNull()
        Unit
    }
    val handleBack: () -> Unit = {
        when {
            searchBackStack.size > 2 -> searchBackStack.removeLastOrNull()
            currentRoute is SearchModeVisit && currentMode == SearchMode.Members && entryInitialTab == 0 ->
                selectMode(0)
            else -> onBackAtRoot()
        }
        Unit
    }
    SideEffect {
        onCurrentUsageScreen(
            ownerVisitID,
            if (isProfileOpen) UsageScreen.Profile else UsageScreen.Search,
        )
    }
    LaunchedEffect(currentRoute, searchBackStack.size, ownerVisitID) {
        if (searchBackStack.size == 1 && currentRoute is SearchHomeVisit) {
            searchBackStack.add(SearchModeVisit(modeFor(entryInitialTab), nextRouteID++))
        }
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(hostMapViewModel, lifecycleOwner, isActiveTabVisit) {
        val lifecycle = lifecycleOwner.lifecycle
        fun updateOwnerLifecycle() {
            hostMapViewModel.onEvent(
                HostMapEvent.OwnerLifecycleChanged(
                    isStarted = isActiveTabVisit && lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED),
                ),
            )
        }
        val observer = LifecycleEventObserver { _, _ -> updateOwnerLifecycle() }
        lifecycle.addObserver(observer)
        updateOwnerLifecycle()
        onDispose {
            lifecycle.removeObserver(observer)
            hostMapViewModel.onEvent(HostMapEvent.OwnerLifecycleChanged(isStarted = false))
        }
    }
    LaunchedEffect(memberSearchViewModel, hostMapViewModel, resetGeneration, resetVisitID, ownerVisitID) {
        if (resetGeneration > appliedResetGeneration && resetVisitID == ownerVisitID) {
            appliedResetGeneration = resetGeneration
            memberSearchViewModel.onEvent(MemberSearchEvent.Reset(resetGeneration))
            hostMapViewModel.onEvent(HostMapEvent.Reset(resetGeneration.toLong()))
            searchBackStack.clear()
            searchBackStack.add(SearchHomeVisit(ownerVisitID))
            searchBackStack.add(SearchModeVisit(SearchMode.Map, nextRouteID++))
            mapResetGeneration = resetGeneration
        }
    }
    val decorators: List<NavEntryDecorator<NavKey>> = listOf(
        rememberSaveableStateHolderNavEntryDecorator(),
        rememberViewModelStoreNavEntryDecorator(),
    )
    BackHandler(
        enabled = searchBackStack.size == 2 && currentRoute is SearchModeVisit &&
            currentMode == SearchMode.Members && entryInitialTab == 0,
        onBack = handleBack,
    )
    NavDisplay(
        backStack = searchBackStack,
        onBack = handleBack,
        entryDecorators = decorators,
        sceneStrategies = listOf(SearchOverlaySceneStrategy, SinglePaneSceneStrategy()),
        entryProvider = entryProvider {
            entry<SearchHomeVisit> { Box(Modifier) }
            entry<SearchModeVisit> { route ->
                when (route.mode) {
                    SearchMode.Map -> androidx.compose.runtime.key(mapResetGeneration) {
                        HostMapScreen(
                            api = api,
                            session = session,
                            onSessionInvalidated = onSessionInvalidated,
                            geocoderLookup = geocoderLookup,
                            contentPadding = contentPadding,
                            viewModel = hostMapViewModel,
                            onOpenHostDetail = pushHostDetail,
                            notesClientFactory = notesClientFactory,
                            mapViewFactory = mapViewFactory,
                            searchModeMenu = { SearchModeMenu(if (currentMode == SearchMode.Map) 0 else 1, selectMode) },
                        )
                    }
                    SearchMode.Members -> MemberSearchScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        contentPadding = contentPadding,
                        onOpenProfile = pushProfile,
                        searchModeMenu = { SearchModeMenu(if (currentMode == SearchMode.Map) 0 else 1, selectMode) },
                        onSwitchToMap = { selectMode(0) },
                        viewModel = memberSearchViewModel,
                    )
                }
            }
            entry<HostDetailVisit>(
                metadata = { SearchOverlaySceneStrategy.metadata(SearchOverlayKind.HostDetail) },
            ) { route ->
                HostDetailScreen(
                    api = api,
                    session = session,
                    route = route,
                    onBack = popRoute,
                    onOpenProfile = pushProfile,
                    onSessionInvalidated = onSessionInvalidated,
                    contentPadding = contentPadding,
                )
            }
            entry<SearchMemberProfileVisit>(
                metadata = { SearchOverlaySceneStrategy.metadata(SearchOverlayKind.Profile) },
            ) { route ->
                MemberProfileScreen(
                    api = api,
                    session = session,
                    username = route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    onBack = popRoute,
                    contentPadding = contentPadding,
                    browserContent = browserContent,
                )
            }
        },
    )
}

private fun modeFor(tab: Int): SearchMode = if (tab == 0) SearchMode.Map else SearchMode.Members
