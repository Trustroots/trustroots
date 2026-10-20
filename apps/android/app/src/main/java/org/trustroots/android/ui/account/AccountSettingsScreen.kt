package org.trustroots.android.ui.account

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.UsageAnalyticsSettings
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.rememberFormLeave
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.updates.ApkUpdateCheckResult

@Composable
internal fun AccountSettingsScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onResetPassword: () -> Unit,
    onSignedOut: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
    enableMessageAlerts: (Activity, MemberSession, (String) -> Unit) -> Unit = MessageAlerts::enable,
    disableMessageAlerts: suspend (Context, MemberSession) -> Unit = MessageAlerts::disable,
    previewUpdateAlerts: Boolean = BuildConfig.PREVIEW_UPDATE_ALERTS,
    isUpdateAlertsEnabled: (Context) -> Boolean = ApkUpdateAlerts::isEnabled,
    setUpdateAlertsEnabled: (Context, Boolean) -> Unit = ApkUpdateAlerts::setEnabled,
    checkPreviewUpdates: suspend (Context) -> ApkUpdateCheckResult = ApkUpdateAlerts::checkNow,
    openPreviewRelease: (Context, String) -> Unit = { updateContext, url ->
        updateContext.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    },
) {
    val context = LocalContext.current
    var messageAlertsEnabled by remember(session.member.username) {
        mutableStateOf(MessageAlerts.isEnabled(context, session.member.username))
    }
    var messageAlertStatus by remember { mutableStateOf<String?>(null) }
    val distributorStatus by MessageAlerts.status.collectAsState()
    var updateAlertsEnabled by remember(session.member.username, previewUpdateAlerts) {
        mutableStateOf(previewUpdateAlerts && isUpdateAlertsEnabled(context))
    }
    var updateStatus by remember { mutableStateOf<String?>(null) }
    var updateReleaseUrl by remember { mutableStateOf<String?>(null) }
    var checkingUpdates by remember { mutableStateOf(false) }
    var updateCheckGeneration by remember { mutableIntStateOf(0) }
    var updateCheckJob by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()
    val startMessageAlerts: () -> Unit = {
        val activity = context as? Activity
        if (activity == null) messageAlertStatus = "Could not choose a push distributor."
        else enableMessageAlerts(activity, session) {
            messageAlertStatus = it
            messageAlertsEnabled = MessageAlerts.isEnabled(context, session.member.username)
        }
    }
    val messagePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startMessageAlerts()
        else messageAlertStatus = "Allow notifications in Android settings to receive message alerts."
    }
    val checkForUpdates: () -> Unit = {
        updateCheckJob?.cancel()
        val generation = ++updateCheckGeneration
        val job = scope.launch(start = CoroutineStart.LAZY) {
            checkingUpdates = true
            try {
                val result = checkPreviewUpdates(context)
                if (generation == updateCheckGeneration) {
                    when (result) {
                        ApkUpdateCheckResult.UpToDate -> {
                            updateStatus = "You have the latest Android preview."
                            updateReleaseUrl = null
                        }
                        is ApkUpdateCheckResult.NewVersion -> {
                            updateStatus = "${result.release.versionName} is available."
                            updateReleaseUrl = result.release.pageUrl
                        }
                        ApkUpdateCheckResult.Unavailable -> {
                            updateStatus = "Could not check for updates. Try again later."
                            updateReleaseUrl = null
                        }
                    }
                }
            } finally {
                if (generation == updateCheckGeneration) {
                    checkingUpdates = false
                    updateCheckJob = null
                }
            }
        }
        updateCheckJob = job
        job.start()
    }
    val updatePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            setUpdateAlertsEnabled(context, true)
            updateAlertsEnabled = true
            checkForUpdates()
        } else {
            updateStatus = "Allow Trustroots notifications in Android settings to receive update alerts."
        }
    }
    var details by remember { mutableStateOf<AccountDetails?>(null) }
    var email by remember { mutableStateOf("") }
    var newsletter by remember { mutableStateOf(false) }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var verifyPassword by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var savingAccount by remember { mutableStateOf(false) }
    var changingPassword by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(session.member.username) {
        loading = true
        api.accountDetails(session).onSuccess {
            details = it
            email = it.email
            newsletter = it.newsletter
            loading = false
        }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else {
                error = it.messageOr("Could not load account.")
                loading = false
            }
        }
    }
    val leave = rememberFormLeave(
        details?.let { email != it.email || newsletter != it.newsletter } == true ||
            currentPassword.isNotEmpty() || newPassword.isNotEmpty() || verifyPassword.isNotEmpty(),
        savingAccount || changingPassword,
        onBack,
    )
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(top = contentPadding.calculateTopPadding(), bottom = contentPadding.calculateBottomPadding())
            .padding(20.dp)
            .testTag("accountSettingsScreen"),
    ) {
        NativeBackButton({ leave(onBack) })
        Text("Account", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        UsageAnalyticsSettings()
        Text(
            "Signed in as ${session.member.displayName} (@${session.member.username}).",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
        if (previewUpdateAlerts) {
            HorizontalDivider(Modifier.padding(vertical = 20.dp))
            ApkUpdateSettings(
                enabled = updateAlertsEnabled,
                checking = checkingUpdates,
                status = updateStatus,
                releaseUrl = updateReleaseUrl,
                onToggle = {
                    if (updateAlertsEnabled) {
                        updateCheckGeneration++
                        updateCheckJob?.cancel()
                        updateCheckJob = null
                        checkingUpdates = false
                        setUpdateAlertsEnabled(context, false)
                        updateAlertsEnabled = false
                        updateStatus = "Update alerts are off."
                        updateReleaseUrl = null
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        updatePermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        setUpdateAlertsEnabled(context, true)
                        updateAlertsEnabled = true
                        checkForUpdates()
                    }
                },
                onCheck = checkForUpdates,
                onOpenRelease = { url -> openPreviewRelease(context, url) },
            )
        }
        when {
            loading -> CircularProgressIndicator(modifier = Modifier.padding(top = 20.dp))
            else -> {
        Text("Email", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
        TextField(
            email,
            { email = it },
            label = { Text(stringResource(R.string.form_email_address)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = newsletter, onCheckedChange = { newsletter = it })
            Text("Community newsletter")
        }
        details?.emailTemporary?.let {
            Text(
                "Email confirmation is pending for $it.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Button(
            onClick = {
                scope.launch {
                    savingAccount = true
                    error = null
                    message = null
                    api.updateAccount(session, email, newsletter).onSuccess {
                        details = it
                        message = "Account saved."
                    }.onFailure {
                        if (it.isAuthenticationFailure()) onSessionInvalidated()
                        else error = it.messageOr("Could not save account.")
                    }
                    savingAccount = false
                }
            },
            enabled = !savingAccount && email.isNotBlank(),
            modifier = Modifier.padding(top = 8.dp),
        ) { Text(if (savingAccount) "Saving…" else "Save email settings") }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Text("Change password", style = MaterialTheme.typography.titleMedium)
        TextField(
            currentPassword,
            { currentPassword = it },
            label = { Text(stringResource(R.string.form_current_password)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        )
        TextField(
            newPassword,
            { newPassword = it },
            label = { Text(stringResource(R.string.form_new_password)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        )
        TextField(
            verifyPassword,
            { verifyPassword = it },
            label = { Text(stringResource(R.string.form_verify_new_password)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        )
        Button(
            onClick = {
                scope.launch {
                    changingPassword = true
                    error = null
                    message = null
                    api.changePassword(session, currentPassword, newPassword, verifyPassword)
                        .onSuccess {
                            currentPassword = ""
                            newPassword = ""
                            verifyPassword = ""
                            message = "Password changed."
                        }
                        .onFailure {
                            if (it.isAuthenticationFailure()) onSessionInvalidated()
                            else error = it.messageOr("Could not change password.")
                        }
                    changingPassword = false
                }
            },
            enabled = !changingPassword &&
                currentPassword.isNotBlank() &&
                newPassword.isNotBlank() &&
                newPassword == verifyPassword,
            modifier = Modifier.padding(top = 8.dp),
        ) { Text(if (changingPassword) "Changing…" else "Change password") }
        TextButton(onClick = { leave(onResetPassword) }) { Text("Forgot your password?") }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Text("Message alerts", style = MaterialTheme.typography.titleMedium)
        Text("Receive an alert for an unread conversation after ten minutes. This requires an installed UnifiedPush distributor, such as ntfy.")
        Button(onClick = {
            if (messageAlertsEnabled) {
                scope.launch {
                    disableMessageAlerts(context, session)
                    messageAlertsEnabled = false
                    messageAlertStatus = "Message alerts are off."
                }
            } else if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                messagePermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else startMessageAlerts()
        }) { Text(if (messageAlertsEnabled) "Turn off message alerts" else "Turn on message alerts") }
        (distributorStatus ?: messageAlertStatus)?.let { Text(it) }
        message?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 10.dp))
        }
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp))
        }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Button(onClick = { leave(onSignedOut) }) { Text("Sign out") }
        Spacer(Modifier.height(24.dp))
            }
        }
    }
}
