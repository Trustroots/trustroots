package org.trustroots.android.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.AccountCircle
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.trustroots.android.analytics.AndroidUsageAnalytics
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.analytics.UsageScreen
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileMember
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.api.SecureResponseCache
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.updates.ApkUpdateCheckResult
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.theme.TrustrootsGreen
import org.trustroots.android.ui.theme.TrustrootsPaleGreen

@Composable
fun TrustrootsApp() {
    val context = LocalContext.current
    val analytics = remember { AndroidUsageAnalytics.get(context) }
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
        SignInScreen(
            analytics = analytics,
            initialMessage = signedOutMessage,
            onSignedIn = {
                sessionStore.save(it)
                session = it
                signedOutMessage = null
            },
        )
    } else {
        MemberShell(
            analytics = analytics,
            session = requireNotNull(session),
            responseCache = responseCache,
            onMemberUpdated = { member ->
                session?.copy(member = member)?.let { updated ->
                    sessionStore.save(updated)
                    session = updated
                }
            },
            onSignedOut = {
                session?.let { responseCache.clear(BuildConfig.API_BASE_URL.trim().trimEnd('/'), it.member.username) }
                sessionStore.clear()
                session = null
            },
            onSessionInvalidated = {
                session?.let { responseCache.clear(BuildConfig.API_BASE_URL.trim().trimEnd('/'), it.member.username) }
                sessionStore.clear()
                session = null
                signedOutMessage =
                    "Your session expired or is no longer valid. Please sign in again."
            },
        )
    }
}

@Composable
internal fun StartupScreen(firstName: String?) {
    val buildDate = rememberBuildDate()
    Box(Modifier.fillMaxSize().background(TrustrootsPaleGreen).safeDrawingPadding()) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = "Trustroots",
                modifier = Modifier.size(180.dp),
            )
            Text("Travellers’ community", style = MaterialTheme.typography.titleMedium)
            if (!firstName.isNullOrBlank()) {
                Text(
                    "Hi $firstName",
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }
        }
        Text(
            "Build: $buildDate",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp),
        )
    }
}

@Composable
private fun rememberBuildDate(): String {
    return remember {
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT)
            .format(Date(BuildConfig.BUILD_EPOCH_SECONDS * 1_000))
    }
}

@Composable
private fun SignInScreen(
    analytics: UsageAnalytics,
    initialMessage: String?,
    onSignedIn: (MemberSession) -> Unit,
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember(initialMessage) { mutableStateOf(initialMessage) }
    var isLoading by remember { mutableStateOf(false) }
    var browserRoute by remember { mutableStateOf<BrowserRoute?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { MobileApiClient(BuildConfig.API_BASE_URL) }
    val buildDate = rememberBuildDate()
    val attemptSignIn: () -> Unit = {
        scope.launch {
            isLoading = true
            error = null
            api.signIn(username.trim(), password)
                .onSuccess(onSignedIn)
                .onFailure { error = it.message ?: "Could not reach Trustroots." }
            isLoading = false
        }
        Unit
    }

    UsageScreenTracking(analytics, if (browserRoute == null) UsageScreen.SignIn else null)
    browserRoute?.let { route ->
        TrustrootsBrowser(route = route, onClose = { browserRoute = null })
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TrustrootsPaleGreen)
            .safeDrawingPadding()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, top = 72.dp, end = 24.dp, bottom = 72.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = "Trustroots",
                modifier = Modifier.size(156.dp),
            )
            Text("Travellers’ community", style = MaterialTheme.typography.titleMedium)
            Text(
                "Sharing, hosting and getting people together.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(28.dp))
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Username or email") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { attemptSignIn() }),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            error?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                )
            }
            Button(
                onClick = attemptSignIn,
                enabled = !isLoading && username.isNotBlank() && password.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 18.dp),
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Sign in")
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                TextButton(
                    onClick = {
                        browserRoute = BrowserRoute(
                            title = "Join Trustroots",
                            url = "https://www.trustroots.org/signup",
                        )
                    },
                ) { Text("Join") }
                TextButton(
                    onClick = {
                        browserRoute = BrowserRoute(
                            title = "Reset password",
                            url = "https://www.trustroots.org/password/forgot",
                        )
                    },
                ) { Text("Forgot password?") }
            }
            Spacer(Modifier.height(20.dp))
            UsageAnalyticsSettings(analytics)
        }
        Text(
            "Build: $buildDate",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.62f),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp),
        )
    }
}

private enum class Destination(val label: String) {
    Circles("Circles"),
    Search("Search"),
    Messages("Messages"),
    Menu("Menu"),
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
    onMemberUpdated: (MobileMember) -> Unit,
    onSignedOut: () -> Unit,
    onSessionInvalidated: () -> Unit,
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
    var hasUnreadMessages by remember { mutableStateOf(false) }
    var unreadMessageCount by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var messagesNavigationID by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var circlesNavigationID by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var searchNavigationID by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    var searchInitialTab by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    val api = remember(session.member.username) {
        MobileApiClient(BuildConfig.API_BASE_URL, responseCache, session.member.username)
    }
    val offlineSavedAt by api.offlineSavedAt.collectAsState()
    val alertDestination by MessageAlerts.destination.collectAsState()
    var initialMessageSender by remember { mutableStateOf<String?>(null) }
    val navigateTo: (Destination) -> Unit = { next ->
        if (next != destination) {
            destinationHistory = destinationHistory + destination
            destination = next
        }
        menuPage = MenuPage.Menu
        browserRoute = null
    }
    LaunchedEffect(session.member.username, alertDestination) {
        val requested = alertDestination ?: return@LaunchedEffect
        if (requested.account != session.member.username) {
            MessageAlerts.clearDestination()
            return@LaunchedEffect
        }
        initialMessageSender = requested.senderId
        messagesNavigationID++
        navigateTo(Destination.Messages)
        MessageAlerts.clearDestination()
    }
    LaunchedEffect(session.member.username) {
        MessageAlerts.reconcile(context, session)
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
                hasUnreadMessages = unreadMessageCount > 0
            }
            delay(60_000)
        }
    }
    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(TrustrootsGreen)
                    .statusBarsPadding()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceAround,
            ) {
                Destination.entries.forEach { item ->
                    IconButton(
                        onClick = {
                            if (item == Destination.Messages) messagesNavigationID++
                            if (item == Destination.Circles) circlesNavigationID++
                            if (item == Destination.Search) {
                                searchInitialTab = 0
                                searchNavigationID++
                            }
                            navigateTo(item)
                        },
                    ) {
                        Box {
                        Icon(
                            imageVector = when (item) {
                                Destination.Circles -> Icons.Default.Groups
                                Destination.Search -> Icons.Default.Search
                                Destination.Messages -> Icons.AutoMirrored.Filled.Chat
                                Destination.Menu -> Icons.Default.Menu
                            },
                            contentDescription = item.label,
                            tint = Color.White,
                            modifier = Modifier.size(32.dp),
                        )
                        if (item == Destination.Messages && hasUnreadMessages) {
                            Badge(
                                modifier = Modifier.align(Alignment.TopEnd),
                                containerColor = Color.Red,
                                contentColor = Color.White,
                            ) {
                                Text(
                                    if (unreadMessageCount > 99) "99+" else unreadMessageCount.toString(),
                                )
                            }
                        }
                        }
                    }
                }
            }
        },
    ) { insets ->
        Column(Modifier.fillMaxSize().padding(insets)) {
            offlineSavedAt?.let { savedAt ->
                Text(
                    "Offline · Showing saved data from " +
                        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(savedAt)),
                    color = Color.White,
                    modifier = Modifier.fillMaxWidth().background(TrustrootsGreen).padding(8.dp),
                )
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
            val browser = browserRoute
            if (browser != null) {
                TrustrootsBrowser(route = browser, onClose = { browserRoute = null })
            } else if (destination == Destination.Menu) {
                when (menuPage) {
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
                        openCircles = {
                            circlesNavigationID++
                            navigateTo(Destination.Circles)
                        },
                        openAccount = { menuPage = MenuPage.Account },
                        openBrowser = { browserRoute = it },
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
                    )
                    MenuPage.Contacts -> ContactsScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = { menuPage = MenuPage.Menu },
                    )
                    MenuPage.Host -> HostOfferScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = { menuPage = MenuPage.Menu },
                    )
                    MenuPage.Account -> AccountSettingsScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = { menuPage = MenuPage.Menu },
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
            } else {
                when (destination) {
                    Destination.Circles -> key(circlesNavigationID) {
                        CirclesScreen(api, session, onSessionInvalidated)
                    }
                    Destination.Search -> key(searchNavigationID) {
                        SearchHubScreen(
                            api,
                            session,
                            onSessionInvalidated,
                            initialTab = searchInitialTab,
                        )
                    }
                    Destination.Messages -> key(messagesNavigationID) {
                        MessageInboxScreen(api, session, onSessionInvalidated, initialMessageSender)
                    }
                    else -> PlaceholderScreen(destination = destination, session = session)
                }
            }
            }
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
) {
    val buildDate = rememberBuildDate()
    Column(
        modifier = Modifier
            .fillMaxSize()
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
                "View your profile",
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        MenuLink("Edit profile", Icons.Default.Edit, openEditProfile)
        MenuLink("Host", Icons.Default.Home, openHost)
        MenuLink("Nostroots", Icons.Default.Public, openNostroots)
        MenuLink("Contacts", Icons.Default.People, openContacts)
        MenuLink("Find people", Icons.Default.PersonSearch, openFindPeople)
        MenuLink("Circles", Icons.Default.Groups, openCircles)
        MenuLink("Account", Icons.Default.Settings, openAccount)
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
                .background(TrustrootsPaleGreen)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = "Trustroots",
                modifier = Modifier.size(72.dp),
            )
            Text("Travellers’ community", color = MaterialTheme.colorScheme.primary)
            Text(
                "API: ${BuildConfig.API_BASE_URL}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                "Build: $buildDate",
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

@Composable
private fun ProfileScreen(session: MemberSession, onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
    ) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Card(
            colors = CardDefaults.cardColors(containerColor = TrustrootsPaleGreen),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
        ) {
            Column(Modifier.padding(22.dp)) {
                Icon(
                    Icons.Default.AccountCircle,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(84.dp),
                )
                Text(
                    session.member.displayName,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    "@${session.member.username}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
internal fun AccountScreen(
    session: MemberSession,
    accountMessage: String?,
    isActionRunning: Boolean,
    actionLabel: String?,
    onBack: () -> Unit,
    onCheckAccount: () -> Unit,
    onResetPassword: () -> Unit,
    onSignedOut: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var updateAlertsEnabled by remember { mutableStateOf(ApkUpdateAlerts.isEnabled(context)) }
    var updateStatus by remember { mutableStateOf<String?>(null) }
    var updateReleaseUrl by remember { mutableStateOf<String?>(null) }
    var checkingUpdates by remember { mutableStateOf(false) }
    val checkForUpdates: () -> Unit = {
        scope.launch {
            checkingUpdates = true
            when (val result = ApkUpdateAlerts.checkNow(context)) {
                ApkUpdateCheckResult.UpToDate -> updateStatus = "You have the latest Android preview."
                is ApkUpdateCheckResult.NewVersion -> {
                    updateStatus = "${result.release.versionName} is available."
                    updateReleaseUrl = result.release.pageUrl
                }
                ApkUpdateCheckResult.Unavailable -> updateStatus = "Could not check for updates. Try again later."
            }
            checkingUpdates = false
        }
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            ApkUpdateAlerts.setEnabled(context, true)
            updateAlertsEnabled = true
            checkForUpdates()
        } else {
            updateStatus = "Allow Trustroots notifications in Android settings to receive update alerts."
        }
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Text("Account", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "Signed in as ${session.member.displayName} (@${session.member.username}).",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onCheckAccount,
            enabled = !isActionRunning,
            modifier = Modifier.padding(top = 20.dp),
        ) { Text("Check account") }
        actionLabel?.let { label ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
                Text(label, modifier = Modifier.padding(start = 10.dp))
            }
        }
        TextButton(onClick = onResetPassword) { Text("Forgot your password?") }
        accountMessage?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 10.dp),
            )
        }
        if (BuildConfig.PREVIEW_UPDATE_ALERTS) {
            HorizontalDivider(Modifier.padding(vertical = 20.dp))
            ApkUpdateSettings(
                enabled = updateAlertsEnabled,
                checking = checkingUpdates,
                status = updateStatus,
                releaseUrl = updateReleaseUrl,
                onToggle = {
                    if (updateAlertsEnabled) {
                        ApkUpdateAlerts.setEnabled(context, false)
                        updateAlertsEnabled = false
                        updateStatus = "Update alerts are off."
                        updateReleaseUrl = null
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        ApkUpdateAlerts.setEnabled(context, true)
                        updateAlertsEnabled = true
                        checkForUpdates()
                    }
                },
                onCheck = checkForUpdates,
                onOpenRelease = { url -> context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) },
            )
        }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Button(onClick = onSignedOut, enabled = !isActionRunning) { Text("Sign out") }
    }
}

@Composable
internal fun ApkUpdateSettings(
    enabled: Boolean,
    checking: Boolean,
    status: String?,
    releaseUrl: String?,
    onToggle: () -> Unit,
    onCheck: () -> Unit,
    onOpenRelease: (String) -> Unit,
) {
    Text("APK updates", style = MaterialTheme.typography.titleMedium)
    Text(
        "Receive an alert when a new signed Android preview is available on GitHub.",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 6.dp),
    )
    Button(onClick = onToggle, modifier = Modifier.padding(top = 12.dp)) {
        Text(if (enabled) "Turn off update alerts" else "Turn on update alerts")
    }
    if (enabled) {
        TextButton(onClick = onCheck, enabled = !checking) {
            Text(if (checking) "Checking for updates…" else "Check for updates now")
        }
    }
    status?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    releaseUrl?.let { url ->
        TextButton(onClick = { onOpenRelease(url) }) { Text("Open release page") }
    }
}

@Composable
private fun PlaceholderScreen(destination: Destination, session: MemberSession) {
    Column(Modifier.padding(20.dp)) {
        Text(destination.label, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text("Signed in as ${session.member.displayName} (@${session.member.username}).")
        Text(
            "This native Android area is ready to use the existing Trustroots API.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
