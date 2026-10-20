package org.trustroots.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.annotation.StringRes
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Public
import androidx.compose.foundation.clickable
import androidx.compose.material3.Button
import androidx.compose.material3.Badge
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.BadgedBox
import androidx.compose.material.icons.filled.BubbleChart
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.saveable.rememberSaveable
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import org.trustroots.android.analytics.AndroidUsageAnalytics
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.DefaultBrowserContent
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.inbox.MessageInboxScreen
import org.trustroots.android.ui.contacts.ContactsScreen
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.LeaveGuard
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.common.RemoteArtwork
import org.trustroots.android.ui.profile.MemberProfileScreen
import org.trustroots.android.ui.signin.SignInDestinationStoreHolder
import org.trustroots.android.ui.signin.SignInScreen
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable

@Composable
internal fun TrustrootsApp(
    apiBaseUrl: String = BuildConfig.API_BASE_URL,
    reconcileAlerts: (Context, MemberSession) -> Unit = MessageAlerts::reconcile,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = DefaultBrowserContent,
) {
    val sessionExpiredMessage = stringResource(R.string.screen_session_expired)
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
                signedOutMessage = sessionExpiredMessage
            },
        )
    }
}

@Composable
internal fun StartupScreen(firstName: String?) {
    val buildDate = rememberBuildDate()
    val brandName = stringResource(R.string.screen_brand_name)
    val communityTagline = stringResource(R.string.screen_travellers_community)
    val buildLabel = stringResource(R.string.screen_build_date, buildDate)
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.primaryContainer).safeDrawingPadding()) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = brandName,
                modifier = Modifier.size(180.dp),
            )
            Text(communityTagline, style = MaterialTheme.typography.titleMedium)
            if (!firstName.isNullOrBlank()) {
                Text(
                    stringResource(R.string.screen_welcome_name, firstName),
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }
        }
        Text(
            buildLabel,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp),
        )
    }
}

@Composable
internal fun rememberBuildDate(): String {
    return remember {
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT)
            .format(Date(BuildConfig.BUILD_EPOCH_SECONDS * 1_000))
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
internal data class MemberTabVisit(val destination: Destination, val visitID: Long) : NavKey

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
    val nostrootsTitle = stringResource(R.string.screen_nostroots)
    val resetPasswordTitle = stringResource(R.string.screen_reset_password)
    val tabBackStack = rememberNavBackStack(MemberTabVisit(Destination.Circles, 0))
    val destination = (tabBackStack.lastOrNull() as? MemberTabVisit)?.destination
        ?: Destination.Circles
    var nextVisitID by rememberSaveable { mutableLongStateOf(1L) }
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
            val firstAvailableID = (tabBackStack.filterIsInstance<MemberTabVisit>()
                .maxOfOrNull(MemberTabVisit::visitID) ?: -1L) + 1L
            nextVisitID = maxOf(nextVisitID, firstAvailableID)
            tabBackStack.add(MemberTabVisit(next, nextVisitID))
            nextVisitID++
        }
        menuPage = MenuPage.Menu
        browserRoute = null
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
    val handleNavigationBack: () -> Unit = {
        val leave = {
            when {
                browserRoute != null -> browserRoute = null
                destination == Destination.Menu && menuPage != MenuPage.Menu -> menuPage = MenuPage.Menu
                tabBackStack.size > 1 -> {
                    tabBackStack.removeLastOrNull()
                    menuPage = MenuPage.Menu
                }
            }
        }
        leaveGuard.value?.invoke(leave) ?: leave()
    }
    BackHandler(
        enabled = browserRoute != null ||
            (destination == Destination.Menu && menuPage != MenuPage.Menu),
        onBack = handleNavigationBack,
    )
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
                            if (item == Destination.Circles && item == destination) {
                                reselectCircles()
                            } else if (item == Destination.Search) {
                                searchInitialTab = 0
                                searchNavigationID++
                                navigateTo(item)
                            } else {
                                navigateTo(item)
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
                    val browser = browserRoute
                    if (browser != null) {
                        browserContent(browser, { browserRoute = null }, contentPadding)
                    } else {
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
                                    Destination.Menu -> when (menuPage) {
                                        MenuPage.Menu -> MenuScreen(
                                            session = session,
                                            openProfile = { menuPage = MenuPage.Profile },
                                            openEditProfile = { menuPage = MenuPage.EditProfile },
                                            openHost = { menuPage = MenuPage.Host },
                                            openNostroots = {
                                                browserRoute = BrowserRoute(
                                                    title = nostrootsTitle,
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
                                            openCircles = {
                                                navigateTo(Destination.Circles)
                                            },
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
                                                    title = resetPasswordTitle,
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
                                    Destination.Circles -> CirclesScreen(
                                        api,
                                        session,
                                        onSessionInvalidated,
                                        contentPadding = contentPadding,
                                    )
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
                                        MessageInboxScreen(
                                            api,
                                            session,
                                            onSessionInvalidated,
                                            initialMessageSender,
                                            contentPadding = contentPadding,
                                        )
                                    }
                                    }
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun MemberNavigationBar(
    destination: Destination,
    unreadMessageCount: Int,
    avatarURL: java.net.URL?,
    sessionCookie: String?,
    memberLabel: String,
    onNavigate: (Destination) -> Unit,
) {
    val unreadCountDescription = pluralStringResource(
        R.plurals.screen_destination_unread_count,
        unreadMessageCount,
        unreadMessageCount,
    )
    NavigationBar(
        modifier = Modifier.shadow(elevation = 8.dp),
        containerColor = MaterialTheme.colorScheme.primary,
        tonalElevation = 0.dp,
    ) {
        Destination.entries.forEach { item ->
            NavigationBarItem(
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    selectedTextColor = MaterialTheme.colorScheme.onPrimary,
                    unselectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    unselectedTextColor = MaterialTheme.colorScheme.onPrimary,
                    indicatorColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.16f),
                ),
                selected = destination == item,
                label = { Text(stringResource(item.label)) },
                onClick = { onNavigate(item) },
                modifier = Modifier.testTag("navigation-${item.name.lowercase()}").semantics {
                    if (item == Destination.Messages) {
                        stateDescription = unreadCountDescription
                    }
                },
                icon = {
                    BadgedBox(badge = {
                        if (item == Destination.Messages && unreadMessageCount > 0) Badge {
                            Text(if (unreadMessageCount > 99) "99+" else unreadMessageCount.toString())
                        }
                    }) {
                        when (item) {
                            Destination.Menu -> RemoteArtwork(
                                url = avatarURL,
                                sessionCookie = sessionCookie,
                                label = memberLabel,
                                size = 24.dp,
                            )
                            Destination.Circles -> Icon(
                                imageVector = Icons.Default.BubbleChart,
                                contentDescription = null,
                            )
                            Destination.Search -> Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                            )
                            Destination.Messages -> Icon(
                                imageVector = Icons.AutoMirrored.Filled.Chat,
                                contentDescription = null,
                            )
                        }
                    }
                },
            )
        }
    }
}

@Composable
internal fun MenuScreen(
    session: MemberSession,
    openProfile: () -> Unit,
    openEditProfile: () -> Unit,
    openHost: () -> Unit,
    openNostroots: () -> Unit,
    openContacts: () -> Unit,
    openFindPeople: () -> Unit,
    openCircles: () -> Unit,
    openAccount: () -> Unit,
    openBrowser: (BrowserRoute) -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val buildDate = rememberBuildDate()
    val viewYourProfile = stringResource(R.string.screen_view_your_profile)
    val editProfile = stringResource(R.string.screen_edit_profile)
    val host = stringResource(R.string.screen_host)
    val nostroots = stringResource(R.string.screen_nostroots)
    val contacts = stringResource(R.string.screen_contacts)
    val findPeople = stringResource(R.string.screen_find_people)
    val circles = stringResource(R.string.screen_destination_circles)
    val account = stringResource(R.string.screen_account)
    val brandName = stringResource(R.string.screen_brand_name)
    val communityTagline = stringResource(R.string.screen_travellers_community)
    val apiLabel = stringResource(R.string.screen_api_url, BuildConfig.API_BASE_URL)
    val buildLabel = stringResource(R.string.screen_build_date, buildDate)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding())
            .padding(contentPadding.horizontalInset())
            .verticalScroll(rememberScrollState())
            .padding(top = 12.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = openProfile)
                .padding(horizontal = 20.dp, vertical = 4.dp),
        ) {
            Text(
                session.member.displayName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "@${session.member.username}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                viewYourProfile,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        MenuLink(editProfile, Icons.Default.Edit, openEditProfile)
        MenuLink(host, Icons.Default.Home, openHost)
        MenuLink(nostroots, Icons.Default.Public, openNostroots)
        MenuLink(contacts, Icons.Default.People, openContacts)
        MenuLink(findPeople, Icons.Default.PersonSearch, openFindPeople)
        MenuLink(circles, Icons.Default.Groups, openCircles)
        MenuLink(account, Icons.Default.Settings, openAccount)
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
            SharedNavigationLinks.INFO_AND_SUPPORT_HEADING,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        )
        SharedNavigationLinks.INFO_AND_SUPPORT.forEach { link ->
            MenuLink(link.label, infoAndSupportIcon(link.id)) {
                openBrowser(BrowserRoute(link.label, link.url))
            }
        }
        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.primaryContainer)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = brandName,
                modifier = Modifier.size(72.dp),
            )
            Text(communityTagline, color = MaterialTheme.colorScheme.primary)
            Text(
                apiLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                buildLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun infoAndSupportIcon(id: String) =
    if (id == "contact" || id == "faq") {
        Icons.AutoMirrored.Filled.HelpOutline
    } else {
        Icons.Default.Info
    }

@Composable
private fun MenuLink(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp),
    ) {
        Icon(icon, contentDescription = null)
        Text(
            label,
            modifier = Modifier
                .weight(1f)
                .padding(start = 14.dp),
            color = MaterialTheme.colorScheme.primary,
        )
    }
}
