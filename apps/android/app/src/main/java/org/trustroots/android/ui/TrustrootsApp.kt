@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.serialization.Serializable
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.analytics.AndroidUsageAnalytics
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.DefaultBrowserContent
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.circles.CirclesNavigationDisplay
import org.trustroots.android.ui.common.LeaveGuard
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.common.MemberNavigationBar
import org.trustroots.android.ui.session.AndroidAppSessionOperations
import org.trustroots.android.ui.session.AppSessionEvent
import org.trustroots.android.ui.session.AppSessionSource
import org.trustroots.android.ui.session.AppSessionViewModel
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.UsageScreenTracking
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.menu.MenuNavigationDisplay
import org.trustroots.android.ui.search.SearchHubScreen
import org.trustroots.android.ui.signin.SignInDestinationStoreHolder
import org.trustroots.android.ui.signin.SignInNavigation
import org.trustroots.android.ui.startup.StartupScreen

@Composable
internal fun TrustrootsApp(
    apiBaseUrl: String = BuildConfig.API_BASE_URL,
    reconcileAlerts: (Context, MemberSession) -> Unit = MessageAlerts::reconcile,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = DefaultBrowserContent,
) {
    val context = LocalContext.current
    val analytics = remember { AndroidUsageAnalytics.get(context) }
    val activity = remember(context) {
        requireNotNull(context.findComponentActivity()) { "TrustrootsApp must run in a ComponentActivity." }
    }
    val signInStoreHolder = remember(activity) {
        ViewModelProvider(activity).get(SignInDestinationStoreHolder::class.java)
    }
    val signInGraphGeneration by signInStoreHolder.graphGeneration.collectAsState()
    DisposableEffect(signInStoreHolder, apiBaseUrl) {
        signInStoreHolder.activateBackend(apiBaseUrl)
        onDispose { }
    }
    val shellGraphStore = remember(activity) {
        ViewModelProvider(activity).get(MemberShellViewModelStoreOwner::class.java)
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, analytics) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) analytics.appOpened()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val sessionStore = remember { SecureMobileSessionStore(context.applicationContext) }
    val responseCache = remember { SecureResponseCache(context.applicationContext) }
    val sessionViewModel = rememberEntryViewModel(
        activity,
        AppSessionViewModel::class.java,
        AppSessionViewModel.Factory(
            AndroidAppSessionOperations(sessionStore, responseCache, signInStoreHolder, shellGraphStore),
            initialBackendURL = apiBaseUrl,
        ),
    )
    DisposableEffect(sessionViewModel, apiBaseUrl) {
        sessionViewModel.onEvent(AppSessionEvent.BackendChanged(apiBaseUrl))
        onDispose { }
    }
    val sessionState by sessionViewModel.state.collectAsState()
    val session = sessionState.session
    val starting = sessionState.isStarting
    val shellGraphOwner = remember(shellGraphStore, starting, session?.member?.username) {
        if (starting) null
        else session?.let { shellGraphStore.activateAccount(it.member.username) }
            ?: run {
                shellGraphStore.clearAccount()
                null
            }
    }
    if (starting) {
        StartupScreen(sessionState.startupFirstName)
        return
    }
    if (session == null) {
        key(signInGraphGeneration, apiBaseUrl.trim().trimEnd('/')) {
            SignInNavigation(
                analytics = analytics,
                storeHolder = signInStoreHolder,
                apiBaseUrl = apiBaseUrl,
                initialMessage = sessionState.signedOutMessage,
                browserContent = browserContent,
                onSignedIn = {
                    sessionViewModel.onEvent(AppSessionEvent.SignedIn(it, apiBaseUrl))
                },
            )
        }
    } else {
        CompositionLocalProvider(
            LocalViewModelStoreOwner provides requireNotNull(shellGraphOwner),
        ) {
          key(requireNotNull(session).member.username) {
            val activeSession = requireNotNull(session)
            val activeSessionSource = AppSessionSource.from(activeSession, apiBaseUrl)
            val rootBackStack = rememberNavBackStack(MemberShellVisit(activeSession.member.username))
            val rootDecorators: List<NavEntryDecorator<NavKey>> = listOf(
                rememberSaveableStateHolderNavEntryDecorator(),
                rememberViewModelStoreNavEntryDecorator(),
            )
            NavDisplay(
                backStack = rootBackStack,
                entryDecorators = rootDecorators,
                entryProvider = entryProvider {
                    entry<MemberShellVisit> {
                        MemberShell(
                            analytics = analytics,
                            session = activeSession,
                            responseCache = responseCache,
                            apiBaseUrl = apiBaseUrl,
                            reconcileAlerts = reconcileAlerts,
                            browserContent = browserContent,
                            onMemberUpdated = { member ->
                                sessionViewModel.onEvent(AppSessionEvent.MemberUpdated(activeSessionSource, member))
                            },
                            onSignedOut = {
                                sessionViewModel.onEvent(AppSessionEvent.SignedOut(activeSessionSource))
                            },
                            onSessionInvalidated = {
                                sessionViewModel.onEvent(AppSessionEvent.SessionInvalidated(activeSessionSource))
                            },
                        )
                    }
                },
            )
          }
        }
    }
}

private tailrec fun Context.findComponentActivity(): ComponentActivity? = when (this) {
    is ComponentActivity -> this
    is ContextWrapper -> baseContext.findComponentActivity()
    else -> null
}

@Serializable
internal enum class Destination(@StringRes val label: Int) {
    Circles(R.string.screen_destination_circles),
    Search(R.string.screen_destination_search),
    Messages(R.string.screen_destination_messages),
    Menu(R.string.screen_destination_profile),
}

/** A unique safe visit to a top-level destination; credentials stay in TrustrootsApp. */
@Serializable
internal data class MemberTabVisit(
    val destination: Destination,
    val visitID: Long,
    val requestedMessageMemberID: String? = null,
) : NavKey

/** Actual decorated owner for authenticated shell state; the username is a safe resource key. */
@Serializable
internal data class MemberShellVisit(val username: String) : NavKey

@Composable
private fun MemberShell(
    analytics: UsageAnalytics,
    session: MemberSession,
    responseCache: SecureResponseCache,
    apiBaseUrl: String,
    reconcileAlerts: (Context, MemberSession) -> Unit,
    onMemberUpdated: (MobileMember) -> Unit,
    onSignedOut: () -> Unit,
    onSessionInvalidated: () -> Unit,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit,
) {
    val context = LocalContext.current
    val nostrootsTitle = stringResource(R.string.screen_nostroots)
    val resetPasswordTitle = stringResource(R.string.screen_reset_password)
    val tabBackStack = rememberNavBackStack(MemberTabVisit(Destination.Circles, 0))
    val destination = (tabBackStack.lastOrNull() as? MemberTabVisit)?.destination
        ?: Destination.Circles
    var nextVisitID by rememberSaveable { mutableLongStateOf(1L) }
    var menuUsageByVisit by remember { mutableStateOf<Map<Long, UsageScreen?>>(emptyMap()) }
    var searchUsageByVisit by remember { mutableStateOf<Map<Long, UsageScreen?>>(emptyMap()) }
    var resetActiveMenuVisit by remember { mutableStateOf<(() -> Unit)?>(null) }
    val leaveGuard = remember { mutableStateOf<LeaveGuard?>(null) }
    val activeVisitID = (tabBackStack.lastOrNull() as? MemberTabVisit)?.visitID ?: 0L
    val activeMenuScreen = if (menuUsageByVisit.containsKey(activeVisitID)) {
        menuUsageByVisit[activeVisitID]
    } else {
        UsageScreen.Menu
    }
    val analyticsScreen = when {
        destination == Destination.Menu -> activeMenuScreen
        destination == Destination.Circles -> UsageScreen.Circles
        destination == Destination.Search -> searchUsageByVisit[activeVisitID] ?: UsageScreen.Search
        else -> UsageScreen.Messages
    }
    UsageScreenTracking(analytics, analyticsScreen)
    var searchInitialTab by rememberSaveable { androidx.compose.runtime.mutableIntStateOf(0) }
    var searchResetGeneration by rememberSaveable { androidx.compose.runtime.mutableIntStateOf(0) }
    var searchResetVisitID by rememberSaveable { androidx.compose.runtime.mutableLongStateOf(-1L) }
    val api = remember(session.member.username, apiBaseUrl.trim().trimEnd('/')) {
        MobileApiClient(apiBaseUrl, responseCache, session.member.username)
    }
    val offlineSavedAt by api.offlineSavedAt.collectAsState()
    val alertDestination by MessageAlerts.destination.collectAsState()
    val shellViewModel = rememberMemberShellViewModel(api, session)
    val shellState by shellViewModel.state.collectAsState()
    LaunchedEffect(activeVisitID) {
        shellViewModel.onEvent(MemberShellEvent.ActiveVisitChanged(activeVisitID))
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, shellViewModel) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> shellViewModel.onEvent(MemberShellEvent.LifecycleChanged(true))
                Lifecycle.Event.ON_STOP -> shellViewModel.onEvent(MemberShellEvent.LifecycleChanged(false))
                else -> Unit
            }
        }
        shellViewModel.onEvent(
            MemberShellEvent.LifecycleChanged(
                lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED),
            ),
        )
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            shellViewModel.onEvent(MemberShellEvent.LifecycleChanged(false))
        }
    }
    LaunchedEffect(shellState.pendingSessionInvalidation?.id) {
        val pending = shellState.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        shellViewModel.onEvent(MemberShellEvent.InvalidationDelivered(pending.id))
    }
    fun navigateTo(next: Destination, resetMenuBeforeLeaving: Boolean = false) {
        if (next != destination) {
            if (resetMenuBeforeLeaving) {
                resetActiveMenuVisit?.invoke()
            }
            val firstAvailableID = (tabBackStack.filterIsInstance<MemberTabVisit>()
                .maxOfOrNull(MemberTabVisit::visitID) ?: -1L) + 1L
            nextVisitID = maxOf(nextVisitID, firstAvailableID)
            tabBackStack.add(MemberTabVisit(next, nextVisitID))
            nextVisitID++
        }
    }
    val reselectCircles = {
        val current = tabBackStack.lastOrNull() as? MemberTabVisit
        if (current?.destination == Destination.Circles) {
            val firstAvailableID = (tabBackStack.filterIsInstance<MemberTabVisit>()
                .maxOfOrNull(MemberTabVisit::visitID) ?: -1L) + 1L
            val replacementID = maxOf(nextVisitID, firstAvailableID)
            tabBackStack[tabBackStack.lastIndex] = MemberTabVisit(Destination.Circles, replacementID)
            nextVisitID = replacementID + 1
        }
    }
    val reselectMessages = {
        val current = tabBackStack.lastOrNull() as? MemberTabVisit
        if (current?.destination == Destination.Messages) {
            val firstAvailableID = (tabBackStack.filterIsInstance<MemberTabVisit>()
                .maxOfOrNull(MemberTabVisit::visitID) ?: -1L) + 1L
            val replacementID = maxOf(nextVisitID, firstAvailableID)
            tabBackStack[tabBackStack.lastIndex] = MemberTabVisit(Destination.Messages, replacementID)
            nextVisitID = replacementID + 1
        }
    }
    LaunchedEffect(session.member.username, alertDestination) {
        val requested = alertDestination ?: return@LaunchedEffect
        if (requested.account != session.member.username) {
            MessageAlerts.clearDestination()
            return@LaunchedEffect
        }
        val guardedMenuDeparture = destination == Destination.Menu && leaveGuard.value != null
        val openConversation = {
            if (guardedMenuDeparture) {
                resetActiveMenuVisit?.invoke()
            }
            val firstAvailableID = (tabBackStack.filterIsInstance<MemberTabVisit>()
                .maxOfOrNull(MemberTabVisit::visitID) ?: -1L) + 1L
            nextVisitID = maxOf(nextVisitID, firstAvailableID)
            tabBackStack.add(MemberTabVisit(Destination.Messages, nextVisitID, requested.senderId))
            nextVisitID++
            Unit
        }
        leaveGuard.value?.invoke(openConversation) ?: openConversation()
        MessageAlerts.clearDestination()
    }
    LaunchedEffect(session.member.username) {
        reconcileAlerts(context, session)
    }
    val handleNavigationBack: () -> Unit = {
        val leave = {
            when {
                tabBackStack.size > 1 -> {
                    tabBackStack.removeLastOrNull()
                }
            }
        }
        leaveGuard.value?.invoke(leave) ?: leave()
    }
    CompositionLocalProvider(LocalLeaveGuard provides leaveGuard) {
        Scaffold(
            contentWindowInsets = WindowInsets.safeDrawing,
            bottomBar = {
                MemberNavigationBar(
                    destination = destination,
                    unreadMessageCount = shellState.unreadMessageCount,
                    avatarURL = shellState.avatarID?.let { api.avatarURL(it, 64) },
                    sessionCookie = session.cookieHeader,
                    memberLabel = session.member.displayName,
                    onNavigate = { item ->
                        val guardedMenuDeparture = destination == Destination.Menu && leaveGuard.value != null
                        val action: () -> Unit = {
                            if (item == Destination.Circles && item == destination) {
                                reselectCircles()
                            } else if (item == Destination.Messages && item == destination) {
                                reselectMessages()
                            } else if (item == Destination.Search && item == destination) {
                                searchInitialTab = 0
                                searchResetVisitID = activeVisitID
                                searchResetGeneration++
                            } else if (item == Destination.Menu && item == destination) {
                                resetActiveMenuVisit?.invoke()
                            } else if (item == Destination.Search) {
                                searchInitialTab = 0
                                navigateTo(item, resetMenuBeforeLeaving = guardedMenuDeparture)
                            } else {
                                navigateTo(item, resetMenuBeforeLeaving = guardedMenuDeparture)
                            }
                        }
                        leaveGuard.value?.invoke(action) ?: action()
                    },
                )
            },
        ) { contentPadding ->
            Column(Modifier.fillMaxSize()) {
                offlineSavedAt?.let { savedAt ->
                    Text(
                        stringResource(
                            R.string.screen_offline_saved_data,
                            SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(savedAt)),
                        ),
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.primary)
                            .padding(top = contentPadding.calculateTopPadding())
                            .padding(8.dp),
                    )
                }
                Box(Modifier.fillMaxWidth().weight(1f)) {
                    val entryDecorators: List<NavEntryDecorator<NavKey>> = listOf(
                        rememberSaveableStateHolderNavEntryDecorator(),
                        rememberViewModelStoreNavEntryDecorator(),
                    )
                    NavDisplay(
                        backStack = tabBackStack,
                        onBack = handleNavigationBack,
                        entryDecorators = entryDecorators,
                        entryProvider = entryProvider {
                            entry<MemberTabVisit> { visit ->
                                when (visit.destination) {
                                    Destination.Menu -> MenuNavigationDisplay(
                                        initialVisitID = visit.visitID,
                                        session = session,
                                        api = api,
                                        onSessionInvalidated = onSessionInvalidated,
                                        onMemberUpdated = onMemberUpdated,
                                        onSignedOut = onSignedOut,
                                        onCurrentUsageScreen = { visitID, screen ->
                                            menuUsageByVisit = menuUsageByVisit + (visitID to screen)
                                        },
                                        isActiveTabVisit = visit.visitID == activeVisitID,
                                        onResetAvailable = { visitID, reset ->
                                            if (visitID == activeVisitID) resetActiveMenuVisit = reset
                                        },
                                        browserContent = browserContent,
                                        contentPadding = contentPadding,
                                        openFindPeople = {
                                            searchInitialTab = 1
                                            navigateTo(Destination.Search)
                                        },
                                        openCircles = {
                                            navigateTo(Destination.Circles)
                                        },
                                    )
                                    Destination.Circles -> {
                                        CirclesNavigationDisplay(
                                            initialVisitID = visit.visitID,
                                            api = api,
                                            session = session,
                                            onSessionInvalidated = onSessionInvalidated,
                                            contentPadding = contentPadding,
                                        )
                                    }
                                    Destination.Search -> {
                                        SearchHubScreen(
                                            api,
                                            session,
                                            onSessionInvalidated,
                                            initialTab = searchInitialTab,
                                            contentPadding = contentPadding,
                                            resetGeneration = searchResetGeneration,
                                            resetVisitID = searchResetVisitID,
                                            ownerVisitID = visit.visitID,
                                            isActiveTabVisit = visit.visitID == activeVisitID,
                                            onCurrentUsageScreen = { visitID, screen ->
                                                if (searchUsageByVisit[visitID] != screen) {
                                                    searchUsageByVisit = searchUsageByVisit + (visitID to screen)
                                                }
                                            },
                                            onBackAtRoot = handleNavigationBack,
                                            browserContent = browserContent,
                                        )
                                    }
                                    Destination.Messages -> MessageInboxScreen(
                                        api = api,
                                        session = session,
                                        onSessionInvalidated = onSessionInvalidated,
                                        initialMemberID = visit.requestedMessageMemberID,
                                        initialVisitID = visit.visitID,
                                        contentPadding = contentPadding,
                                    )
                                }
                            }
                        },
                    )
                }
            }
        }
    }
}
