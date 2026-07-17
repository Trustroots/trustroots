package org.trustroots.android.ui

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import java.text.DateFormat
import java.util.Date
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.api.MobileSession
import org.trustroots.android.api.SecureMobileSessionStore
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.TrustrootsBrowser
import org.trustroots.android.ui.theme.TrustrootsGreen
import org.trustroots.android.ui.theme.TrustrootsPaleGreen

@Composable
fun TrustrootsApp() {
    val context = LocalContext.current
    val sessionStore = remember { SecureMobileSessionStore(context.applicationContext) }
    var session by remember { mutableStateOf(sessionStore.load()) }
    var signedOutMessage by remember { mutableStateOf<String?>(null) }
    val api = remember { MobileApiClient(BuildConfig.API_BASE_URL) }
    LaunchedEffect(Unit) {
        session?.let { storedSession ->
            api.refresh(storedSession.refreshToken)
                .onSuccess { refreshedSession ->
                    sessionStore.save(refreshedSession)
                    session = refreshedSession
                }
                .onFailure { error ->
                    if ((error as? MobileApiException)?.isAuthenticationFailure == true) {
                        sessionStore.clear()
                        session = null
                        signedOutMessage =
                            "Your session expired or is no longer valid. Please sign in again."
                    }
                }
        }
    }
    if (session == null) {
        SignInScreen(
            initialMessage = signedOutMessage,
            onSignedIn = {
                sessionStore.save(it)
                session = it
                signedOutMessage = null
            },
        )
    } else {
        MemberShell(
            session = requireNotNull(session),
            onSessionUpdated = {
                sessionStore.save(it)
                session = it
            },
            onSignedOut = {
                sessionStore.clear()
                session = null
            },
            onSessionInvalidated = {
                sessionStore.clear()
                session = null
                signedOutMessage =
                    "Your session expired or is no longer valid. Please sign in again."
            },
        )
    }
}

@Composable
private fun SignInScreen(
    initialMessage: String?,
    onSignedIn: (MobileSession) -> Unit,
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember(initialMessage) { mutableStateOf(initialMessage) }
    var isLoading by remember { mutableStateOf(false) }
    var browserRoute by remember { mutableStateOf<BrowserRoute?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { MobileApiClient(BuildConfig.API_BASE_URL) }
    val context = LocalContext.current
    val buildDate = remember {
        val installedAt = context.packageManager
            .getPackageInfo(context.packageName, 0)
            .lastUpdateTime
        DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
            .format(Date(installedAt))
    }
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

    browserRoute?.let { route ->
        TrustrootsBrowser(route = route, onClose = { browserRoute = null })
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TrustrootsPaleGreen)
            .padding(horizontal = 24.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.trustroots_logo),
            contentDescription = "Trustroots",
            modifier = Modifier.size(124.dp),
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
        Text(
            "API: ${BuildConfig.API_BASE_URL}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 14.dp),
        )
        Text(
            "Build: $buildDate",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 3.dp),
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
    Account,
}

@Composable
private fun MemberShell(
    session: MobileSession,
    onSessionUpdated: (MobileSession) -> Unit,
    onSignedOut: () -> Unit,
    onSessionInvalidated: () -> Unit,
) {
    var destination by remember { mutableStateOf(Destination.Circles) }
    var menuPage by remember { mutableStateOf(MenuPage.Menu) }
    var browserRoute by remember { mutableStateOf<BrowserRoute?>(null) }
    var accountMessage by remember { mutableStateOf<String?>(null) }
    var isAccountActionRunning by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val api = remember { MobileApiClient(BuildConfig.API_BASE_URL) }
    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(TrustrootsGreen)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceAround,
            ) {
                Destination.entries.forEach { item ->
                    IconButton(
                        onClick = {
                            destination = item
                            menuPage = MenuPage.Menu
                            browserRoute = null
                        },
                    ) {
                        Icon(
                            imageVector = when (item) {
                                Destination.Circles -> Icons.Default.Groups
                                Destination.Search -> Icons.Default.Search
                                Destination.Messages -> Icons.AutoMirrored.Filled.Send
                                Destination.Menu -> Icons.Default.Menu
                            },
                            contentDescription = item.label,
                            tint = Color.White,
                        )
                    }
                }
            }
        },
    ) { insets ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(insets),
        ) {
            val browser = browserRoute
            if (browser != null) {
                TrustrootsBrowser(route = browser, onClose = { browserRoute = null })
            } else if (destination == Destination.Menu) {
                when (menuPage) {
                    MenuPage.Menu -> MenuScreen(
                        session = session,
                        openProfile = { menuPage = MenuPage.Profile },
                        openAccount = { menuPage = MenuPage.Account },
                        openBrowser = { browserRoute = it },
                    )
                    MenuPage.Profile -> ProfileScreen(
                        session = session,
                        onBack = { menuPage = MenuPage.Menu },
                    )
                    MenuPage.Account -> AccountScreen(
                        session = session,
                        accountMessage = accountMessage,
                        isActionRunning = isAccountActionRunning,
                        onBack = { menuPage = MenuPage.Menu },
                        onCheckAccount = {
                            scope.launch {
                                isAccountActionRunning = true
                                api.currentMember(session.accessToken)
                                    .onSuccess { accountMessage = "Signed in as ${it.displayName}." }
                                    .onFailure {
                                        if ((it as? MobileApiException)?.isAuthenticationFailure == true) {
                                            onSessionInvalidated()
                                        } else {
                                            accountMessage = it.message ?: "Could not refresh account."
                                        }
                                    }
                                isAccountActionRunning = false
                            }
                        },
                        onRefreshSession = {
                            scope.launch {
                                isAccountActionRunning = true
                                api.refresh(session.refreshToken)
                                    .onSuccess {
                                        onSessionUpdated(it)
                                        accountMessage = "Session refreshed."
                                    }
                                    .onFailure {
                                        if ((it as? MobileApiException)?.isAuthenticationFailure == true) {
                                            onSessionInvalidated()
                                        } else {
                                            accountMessage = it.message ?: "Could not refresh session."
                                        }
                                    }
                                isAccountActionRunning = false
                            }
                        },
                        onResetPassword = {
                            browserRoute = BrowserRoute(
                                title = "Reset password",
                                url = "https://www.trustroots.org/password/forgot",
                            )
                        },
                        onSignedOut = {
                            scope.launch {
                                isAccountActionRunning = true
                                api.signOut(session.accessToken)
                                onSignedOut()
                            }
                        },
                    )
                }
            } else {
                PlaceholderScreen(destination = destination, session = session)
            }
        }
    }
}

@Composable
private fun MenuScreen(
    session: MobileSession,
    openProfile: () -> Unit,
    openAccount: () -> Unit,
    openBrowser: (BrowserRoute) -> Unit,
) {
    val context = LocalContext.current
    val buildDate = remember {
        val installedAt = context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
        DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(installedAt))
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(top = 12.dp),
    ) {
        Text(
            "${session.member.displayName}",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        Text(
            "@${session.member.username}",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp),
        )
        Spacer(Modifier.height(16.dp))
        MenuLink("My profile", Icons.Default.AccountCircle, openProfile)
        MenuLink("Account", Icons.Default.Settings, openAccount)
        HorizontalDivider()
        MenuLink("Frequently asked questions", Icons.AutoMirrored.Filled.HelpOutline) {
            openBrowser(BrowserRoute("Frequently asked questions", "https://www.trustroots.org/faq"))
        }
        MenuLink("About Trustroots", Icons.Default.Info) {
            openBrowser(BrowserRoute("About Trustroots", "https://www.trustroots.org/about"))
        }
        MenuLink("Privacy", Icons.Default.Info) {
            openBrowser(BrowserRoute("Privacy", "https://www.trustroots.org/privacy"))
        }
        MenuLink("Rules", Icons.Default.Info) {
            openBrowser(BrowserRoute("Rules", "https://www.trustroots.org/rules"))
        }
        MenuLink("Statistics", Icons.Default.Info) {
            openBrowser(BrowserRoute("Trustroots statistics", "https://www.trustroots.org/statistics"))
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
private fun ProfileScreen(session: MobileSession, onBack: () -> Unit) {
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
private fun AccountScreen(
    session: MobileSession,
    accountMessage: String?,
    isActionRunning: Boolean,
    onBack: () -> Unit,
    onCheckAccount: () -> Unit,
    onRefreshSession: () -> Unit,
    onResetPassword: () -> Unit,
    onSignedOut: () -> Unit,
) {
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
        Button(
            onClick = onRefreshSession,
            enabled = !isActionRunning,
            modifier = Modifier.padding(top = 8.dp),
        ) { Text("Refresh session") }
        TextButton(onClick = onResetPassword) { Text("Forgot your password?") }
        accountMessage?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 10.dp),
            )
        }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Button(onClick = onSignedOut, enabled = !isActionRunning) { Text("Sign out") }
    }
}

@Composable
private fun PlaceholderScreen(destination: Destination, session: MobileSession) {
    Column(Modifier.padding(20.dp)) {
        Text(destination.label, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text("Signed in as ${session.member.displayName} (@${session.member.username}).")
        Text(
            "This native Android area is ready for the shared mobile API implementation.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
