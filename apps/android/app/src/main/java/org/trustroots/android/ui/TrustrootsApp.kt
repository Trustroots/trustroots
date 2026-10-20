package org.trustroots.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.trustroots.android.BuildConfig
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
import org.trustroots.android.ui.account.AccountSettingsScreen
import org.trustroots.android.ui.circles.CirclesScreen
import org.trustroots.android.ui.common.LeaveGuard
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.common.MemberNavigationBar
import org.trustroots.android.ui.common.UsageScreenTracking
import org.trustroots.android.ui.contacts.ContactsScreen
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.menu.MenuScreen
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.search.SearchHubScreen
import org.trustroots.android.ui.signin.SignInDestinationStoreHolder
import org.trustroots.android.ui.signin.SignInScreen
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
    var session by remember { mutableStateOf<MemberSession?>(null) }
    var starting by remember { mutableStateOf(true) }
    var signedOutMessage by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(sessionStore) {
        val startedAt = android.os.SystemClock.elapsedRealtime()
        session = withContext(Dispatchers.IO) { sessionStore.load() }
        val remaining = 700 - (android.os.SystemClock.elapsedRealtime() - startedAt)
        if (remaining > 0) delay(remaining)
        starting = false
    }
    if (starting) {
        StartupScreen(session?.member?.displayName?.substringBefore(' '))
        return
    }
    if (session == null) {
        val signInViewModel = remember(signInStoreHolder, apiBaseUrl, signedOutMessage) {
            signInStoreHolder.getViewModel(apiBaseUrl, signedOutMessage)
        }
        SignInScreen(
            analytics = analytics,
            viewModel = signInViewModel,
            browserContent = browserContent,
            onSignedIn = {
                sessionStore.save(it)
                session = it
                signedOutMessage = null
                signInStoreHolder.clearDestination()
            },
        )
    } else {
        MemberShell(
            analytics = analytics,
            session = requireNotNull(session),
            responseCache = responseCache,
            apiBaseUrl = apiBaseUrl,
            reconcileAlerts = reconcileAlerts,
            browserContent = browserContent,
            onMemberUpdated = { member ->
                session?.copy(member = member)?.let { updated ->
                    sessionStore.save(updated)
                    session = updated
                }
            },
            onSignedOut = {
                session?.let { responseCache.clear(apiBaseUrl.trim().trimEnd('/'), it.member.username) }
                sessionStore.clear()
                signInStoreHolder.clearDestination()
                session = null
            },
            onSessionInvalidated = {
                session?.let { responseCache.clear(apiBaseUrl.trim().trimEnd('/'), it.member.username) }
                sessionStore.clear()
                signInStoreHolder.clearDestination()
                session = null
                signedOutMessage =
                    "Your session expired or is no longer valid. Please sign in again."
            },
        )
    }
}

private tailrec fun Context.findComponentActivity(): ComponentActivity? = when (this) {
    is ComponentActivity -> this
    is ContextWrapper -> baseContext.findComponentActivity()
    else -> null
}

internal enum class Destination(val label: String) {
    Circles("Circles"),
    Search("Search"),
    Messages("Messages"),
    Menu("Profile"),
}

private enum class MenuPage {
    Menu,
    Profile,
    EditProfile,
    Contacts,
    Host,
    Account,
}

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
    var destination by remember { mutableStateOf(Destination.Circles) }
    var destinationHistory by remember { mutableStateOf(emptyList<Destination>()) }
    var menuPage by remember { mutableStateOf(MenuPage.Menu) }
    var browserRoute by remember { mutableStateOf<BrowserRoute?>(null) }
    val analyticsScreen = when {
        browserRoute != null -> null
        destination == Destination.Menu -> when (menuPage) {
            MenuPage.Menu -> UsageScreen.Menu
            MenuPage.Profile -> UsageScreen.Profile
            MenuPage.EditProfile -> UsageScreen.EditProfile
            MenuPage.Contacts -> UsageScreen.Contacts
            MenuPage.Host -> UsageScreen.Host
            MenuPage.Account -> UsageScreen.Account
        }
        destination == Destination.Circles -> UsageScreen.Circles
        destination == Destination.Search -> UsageScreen.Search
        else -> UsageScreen.Messages
    }
    UsageScreenTracking(analytics, analyticsScreen)
    var unreadMessageCount by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var messagesNavigationID by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var circlesNavigationID by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var searchNavigationID by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var searchInitialTab by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    val api = remember(session.member.username) {
        MobileApiClient(apiBaseUrl, responseCache, session.member.username)
    }
    val offlineSavedAt by api.offlineSavedAt.collectAsState()
    val alertDestination by MessageAlerts.destination.collectAsState()
    var initialMessageSender by remember { mutableStateOf<String?>(null) }
    var ownAvatarID by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(api) { api.profile(session, session.member.username).onSuccess { ownAvatarID = it.id } }
    val navigateTo: (Destination) -> Unit = { next ->
        if (next != destination) {
            destinationHistory = destinationHistory + destination
            destination = next
        }
        menuPage = MenuPage.Menu
        browserRoute = null
    }
    val leaveGuard = remember { mutableStateOf<LeaveGuard?>(null) }
    LaunchedEffect(session.member.username, alertDestination) {
        val requested = alertDestination ?: return@LaunchedEffect
        if (requested.account != session.member.username) {
            MessageAlerts.clearDestination()
            return@LaunchedEffect
        }
        val openConversation = {
            initialMessageSender = requested.senderId
            messagesNavigationID++
            navigateTo(Destination.Messages)
        }
        leaveGuard.value?.invoke(openConversation) ?: openConversation()
        MessageAlerts.clearDestination()
    }
    LaunchedEffect(session.member.username) {
        reconcileAlerts(context, session)
    }
    BackHandler(
        enabled = browserRoute != null ||
            (destination == Destination.Menu && menuPage != MenuPage.Menu) ||
            destinationHistory.isNotEmpty(),
    ) {
        when {
            browserRoute != null -> browserRoute = null
            destination == Destination.Menu && menuPage != MenuPage.Menu -> menuPage = MenuPage.Menu
            destinationHistory.isNotEmpty() -> {
                destination = destinationHistory.last()
                destinationHistory = destinationHistory.dropLast(1)
                menuPage = MenuPage.Menu
            }
        }
    }
    LaunchedEffect(session, destination, messagesNavigationID) {
        while (true) {
            api.inbox(session).onSuccess { threads ->
                unreadMessageCount = threads.count { !it.read }
            }
            delay(60_000)
        }
    }
    CompositionLocalProvider(LocalLeaveGuard provides leaveGuard) {
    Scaffold(
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            MemberNavigationBar(
                destination = destination,
                unreadMessageCount = unreadMessageCount,
                avatarURL = ownAvatarID?.let { api.avatarURL(it, 64) },
                sessionCookie = session.cookieHeader,
                memberLabel = session.member.displayName,
                onNavigate = { item ->
                    val action = {
                        if (item == Destination.Messages) messagesNavigationID++
                        if (item == Destination.Circles) circlesNavigationID++
                        if (item == Destination.Search) {
                            searchInitialTab = 0
                            searchNavigationID++
                        }
                        navigateTo(item)
                    }
                    leaveGuard.value?.invoke(action) ?: action()
                },
            )
        },
    ) { contentPadding ->
        Column(Modifier.fillMaxSize()) {
            offlineSavedAt?.let { savedAt ->
                Text(
                    "Offline · Showing saved data from " +
                        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(savedAt)),
                    color = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.primary)
                        .padding(top = contentPadding.calculateTopPadding())
                        .padding(8.dp),
                )
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                val browser = browserRoute
                if (browser != null) {
                    browserContent(browser, { browserRoute = null }, contentPadding)
                } else {
                    when (destination) {
                        Destination.Menu -> when (menuPage) {
                            MenuPage.Menu -> MenuScreen(
                                session = session,
                                openProfile = { menuPage = MenuPage.Profile },
                                openEditProfile = { menuPage = MenuPage.EditProfile },
                                openHost = { menuPage = MenuPage.Host },
                                openNostroots = {
                                    browserRoute = BrowserRoute(
                                        title = "Nostroots",
                                        url = "https://nos.trustroots.org/",
                                        sessionCookie = session.cookieHeader,
                                    )
                                },
                                openContacts = { menuPage = MenuPage.Contacts },
                                openFindPeople = {
                                    searchInitialTab = 1
                                    searchNavigationID++
                                    navigateTo(Destination.Search)
                                },
                                openCircles = { circlesNavigationID++; navigateTo(Destination.Circles) },
                                openAccount = { menuPage = MenuPage.Account },
                                openBrowser = { browserRoute = it },
                                contentPadding = contentPadding,
                            )
                            MenuPage.Profile -> MemberProfileScreen(
                                api = api,
                                session = session,
                                username = session.member.username,
                                onSessionInvalidated = onSessionInvalidated,
                                onBack = { menuPage = MenuPage.Menu },
                                onOwnProfileSaved = { updated ->
                                    onMemberUpdated(MobileMember(updated.username, updated.displayName))
                                },
                                contentPadding = contentPadding,
                            )
                            MenuPage.EditProfile -> MemberProfileScreen(
                                api = api,
                                session = session,
                                username = session.member.username,
                                onSessionInvalidated = onSessionInvalidated,
                                startInEditMode = true,
                                onBack = { menuPage = MenuPage.Menu },
                                onOwnProfileSaved = { updated ->
                                    onMemberUpdated(MobileMember(updated.username, updated.displayName))
                                },
                                contentPadding = contentPadding,
                            )
                            MenuPage.Contacts -> ContactsScreen(
                                api = api,
                                session = session,
                                onSessionInvalidated = onSessionInvalidated,
                                onBack = { menuPage = MenuPage.Menu },
                                contentPadding = contentPadding,
                            )
                            MenuPage.Host -> HostOfferScreen(
                                api = api,
                                session = session,
                                onSessionInvalidated = onSessionInvalidated,
                                onBack = { menuPage = MenuPage.Menu },
                                contentPadding = contentPadding,
                            )
                            MenuPage.Account -> AccountSettingsScreen(
                                api = api,
                                session = session,
                                onSessionInvalidated = onSessionInvalidated,
                                onBack = { menuPage = MenuPage.Menu },
                                contentPadding = contentPadding,
                                onResetPassword = {
                                    browserRoute = BrowserRoute(
                                        title = "Reset password",
                                        url = "https://www.trustroots.org/password/forgot",
                                    )
                                },
                                onSignedOut = {
                                    CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
                                        MessageAlerts.disable(context, session)
                                        api.signOut(session)
                                        withContext(Dispatchers.Main) { onSignedOut() }
                                    }
                                },
                            )
                        }
                        Destination.Circles -> key(circlesNavigationID) {
                            CirclesScreen(api, session, onSessionInvalidated, contentPadding = contentPadding)
                        }
                        Destination.Search -> key(searchNavigationID) {
                            SearchHubScreen(
                                api,
                                session,
                                onSessionInvalidated,
                                initialTab = searchInitialTab,
                                contentPadding = contentPadding,
                            )
                        }
                        Destination.Messages -> key(messagesNavigationID) {
                            MessageInboxScreen(api, session, onSessionInvalidated, initialMessageSender, contentPadding = contentPadding)
                        }
                    }
                }
            }
            }
        }
    }
}
