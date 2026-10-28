@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.account

import org.trustroots.android.ui.common.requireNavigationViewModelStoreOwner

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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import org.trustroots.android.BuildConfig
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.notifications.MessageAlertStatusMetadata
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.updates.ApkUpdateCheckResult
import org.trustroots.android.ui.common.LabelledCheckbox
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.rememberEntryViewModel
import org.trustroots.android.ui.common.UsageAnalyticsSettings
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.rememberFormLeave
import org.trustroots.android.ui.common.resolveFailureMessage

@Composable
internal fun AccountSettingsScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onResetPassword: () -> Unit,
    onSignedOut: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
    enableMessageAlerts: (Activity, MemberSession, (MessageAlertStatusMetadata) -> Unit) -> Unit = MessageAlerts::enableWithStatus,
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
    val owner = requireNavigationViewModelStoreOwner("Account must be hosted by its decorated Menu Navigation 3 entry.")
    val platform = remember(context.applicationContext, previewUpdateAlerts, isUpdateAlertsEnabled, setUpdateAlertsEnabled, checkPreviewUpdates, disableMessageAlerts) {
        AndroidAccountPlatformSettings(
            context = context.applicationContext,
            session = session,
            previewAlertsEnabled = previewUpdateAlerts,
            isUpdateAlertsEnabled = isUpdateAlertsEnabled,
            setUpdateAlertsEnabled = setUpdateAlertsEnabled,
            checkPreviewUpdates = checkPreviewUpdates,
            disableMessageAlerts = disableMessageAlerts,
        )
    }
    val viewModel = rememberEntryViewModel(
        owner = owner,
        modelClass = AccountSettingsViewModel::class.java,
        factory = AccountSettingsViewModel.Factory(
            username = session.member.username,
            repository = MobileApiAccountRepository(api, session),
            platform = platform,
            api = api,
            session = session,
        ),
    )
    SideEffect {
        platform.updateSession(session)
        viewModel.updateEnvironment(api, session, platform)
    }
    val state by viewModel.state.collectAsState()
    val accountTitle = stringResource(R.string.screen_account_title)
    val signedInAs = stringResource(R.string.screen_signed_in_as, session.member.displayName, session.member.username)
    val emailLabel = stringResource(R.string.screen_email)
    val newsletterLabel = stringResource(R.string.screen_newsletter)
    val emailConfirmationPending = stringResource(R.string.screen_email_confirmation_pending)
    val accountSaved = stringResource(R.string.screen_account_saved)
    val saveEmailSettings = stringResource(R.string.screen_save_email_settings)
    val changePasswordLabel = stringResource(R.string.screen_change_password)
    val passwordChanged = stringResource(R.string.screen_password_changed)
    val forgotYourPassword = stringResource(R.string.screen_forgot_your_password)
    val messageAlertsTitle = stringResource(R.string.screen_message_alerts)
    val messageAlertsDescription = stringResource(R.string.screen_message_alerts_description)
    val turnOffMessageAlerts = stringResource(R.string.screen_turn_off_message_alerts)
    val turnOnMessageAlerts = stringResource(R.string.screen_turn_on_message_alerts)
    val signOutLabel = stringResource(R.string.screen_sign_out)
    val savingLabel = stringResource(R.string.saving)
    val changingLabel = stringResource(R.string.screen_changing_password)
    val latestAndroidPreview = stringResource(R.string.screen_latest_android_preview)
    val updateAvailableFormat = stringResource(R.string.screen_update_available)
    val updateCheckError = stringResource(R.string.screen_update_check_error)
    val allowUpdateNotifications = stringResource(R.string.screen_allow_update_notifications)
    val updateAlertsOff = stringResource(R.string.screen_update_alerts_off)
    val uiLocale = androidx.compose.ui.platform.LocalConfiguration.current.locales[0]
    val leave = rememberFormLeave(state.isDirty, state.isBusy, onBack)

    val messagePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        viewModel.onEvent(AccountEvent.NotificationPermissionResult(AccountPermissionTarget.MESSAGE_ALERTS, granted))
    }
    val updatePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        viewModel.onEvent(AccountEvent.NotificationPermissionResult(AccountPermissionTarget.PREVIEW_UPDATES, granted))
    }
    LaunchedEffect(state.pendingEffect?.id) {
        val effect = state.pendingEffect ?: return@LaunchedEffect
        viewModel.onEvent(AccountEvent.EffectDelivered(effect.id))
        when (effect) {
            is AccountEffect.RequestNotificationPermission -> {
                val launcher = when (effect.target) {
                    AccountPermissionTarget.MESSAGE_ALERTS -> messagePermission
                    AccountPermissionTarget.PREVIEW_UPDATES -> updatePermission
                }
                launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            is AccountEffect.EnableMessageAlerts -> {
                val activity = context.findActivity()
                if (activity == null) {
                    viewModel.onEvent(AccountEvent.MessageAlertsEnabled(MessageAlertStatusMetadata(R.string.screen_could_not_choose_push_distributor)))
                } else {
                    enableMessageAlerts(activity, session) { result -> viewModel.onEvent(AccountEvent.MessageAlertsEnabled(result)) }
                }
            }
            is AccountEffect.OpenRelease -> openPreviewRelease(context, effect.url)
            is AccountEffect.OpenResetPassword -> onResetPassword()
            is AccountEffect.SignedOut -> onSignedOut()
            is AccountEffect.SessionInvalidated -> onSessionInvalidated()
        }
    }

    val messageStatus = state.messageAlertStatus?.let { status ->
        stringResource(status.resourceId, *status.formatArgs.toTypedArray())
    }
    val updateStatus = when (val status = state.updateStatus) {
        AccountUpdateStatus.AlertsOff -> updateAlertsOff
        AccountUpdateStatus.PermissionDenied -> allowUpdateNotifications
        AccountUpdateStatus.Latest -> latestAndroidPreview
        AccountUpdateStatus.Unavailable -> updateCheckError
        is AccountUpdateStatus.NewVersion -> String.format(uiLocale, updateAvailableFormat, status.versionName)
        null -> null
    }
    val updateReleaseUrl = (state.updateStatus as? AccountUpdateStatus.NewVersion)?.pageUrl
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()

    Scaffold(
        modifier = Modifier.fillMaxSize().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            PinnedTopAppBar(
                title = accountTitle,
                scrollBehavior = scrollBehavior,
                contentPadding = contentPadding,
                onBack = { leave(onBack) },
            )
        },
    ) { appBarPadding ->
        Column(
            Modifier.fillMaxSize()
                .padding(top = appBarPadding.calculateTopPadding())
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(contentPadding.horizontalInset())
                .testTag("accountSettingsScreen"),
        ) {
            UsageAnalyticsSettings()
            Text(signedInAs, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
            if (previewUpdateAlerts) {
                HorizontalDivider(Modifier.padding(vertical = 20.dp))
                ApkUpdateSettings(
                    enabled = state.updateAlertsEnabled,
                    checking = state.isCheckingUpdates,
                    status = updateStatus,
                    releaseUrl = updateReleaseUrl,
                    onToggle = {
                        viewModel.onEvent(AccountEvent.ToggleUpdateAlerts(context.canPostNotifications()))
                    },
                    onCheck = { viewModel.onEvent(AccountEvent.CheckPreviewUpdates) },
                    onOpenRelease = { viewModel.onEvent(AccountEvent.OpenRelease) },
                )
            }
            if (state.isLoading) {
                CircularProgressIndicator(modifier = Modifier.padding(top = 20.dp))
            } else {
                Text(emailLabel, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
                TextField(
                    value = state.email,
                    onValueChange = { viewModel.onEvent(AccountEvent.EmailChanged(it)) },
                    label = { Text(stringResource(R.string.form_email_address)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                )
                LabelledCheckbox(
                    label = newsletterLabel,
                    checked = state.newsletter,
                    onCheckedChange = { viewModel.onEvent(AccountEvent.NewsletterChanged(it)) },
                )
                state.details?.emailTemporary?.let {
                    Text(
                        String.format(uiLocale, emailConfirmationPending, it),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Button(
                    onClick = { viewModel.onEvent(AccountEvent.SaveAccount) },
                    enabled = !state.isSavingAccount && state.email.isNotBlank(),
                    modifier = Modifier.padding(top = 8.dp),
                ) { Text(if (state.isSavingAccount) savingLabel else saveEmailSettings) }
                HorizontalDivider(Modifier.padding(vertical = 20.dp))
                Text(changePasswordLabel, style = MaterialTheme.typography.titleMedium)
                TextField(
                    value = state.currentPassword,
                    onValueChange = { viewModel.onEvent(AccountEvent.CurrentPasswordChanged(it)) },
                    label = { Text(stringResource(R.string.form_current_password)) },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                )
                TextField(
                    value = state.newPassword,
                    onValueChange = { viewModel.onEvent(AccountEvent.NewPasswordChanged(it)) },
                    label = { Text(stringResource(R.string.form_new_password)) },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                )
                TextField(
                    value = state.verifyPassword,
                    onValueChange = { viewModel.onEvent(AccountEvent.VerifyPasswordChanged(it)) },
                    label = { Text(stringResource(R.string.form_verify_new_password)) },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                )
                Button(
                    onClick = { viewModel.onEvent(AccountEvent.ChangePassword) },
                    enabled = !state.isChangingPassword && state.currentPassword.isNotBlank() &&
                        state.newPassword.isNotBlank() && state.newPassword == state.verifyPassword,
                    modifier = Modifier.padding(top = 8.dp),
                ) { Text(if (state.isChangingPassword) changingLabel else changePasswordLabel) }
                TextButton(onClick = { leave { viewModel.onEvent(AccountEvent.ResetPassword) } }) { Text(forgotYourPassword) }
                HorizontalDivider(Modifier.padding(vertical = 20.dp))
                Text(messageAlertsTitle, style = MaterialTheme.typography.titleMedium)
                Text(messageAlertsDescription)
                Button(onClick = { viewModel.onEvent(AccountEvent.ToggleMessageAlerts(context.canPostNotifications())) }) {
                    Text(if (state.messageAlertsEnabled) turnOffMessageAlerts else turnOnMessageAlerts)
                }
                messageStatus?.let { Text(it) }
                state.notice?.let { notice ->
                    val text = when (notice) {
                        AccountNotice.AccountSaved -> accountSaved
                        AccountNotice.PasswordChanged -> passwordChanged
                    }
                    Text(text, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 10.dp))
                }
                state.failure?.let {
                    Text(resolveFailureMessage(it), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp))
                }
                HorizontalDivider(Modifier.padding(vertical = 20.dp))
                Button(onClick = { leave { viewModel.onEvent(AccountEvent.SignOut) } }, enabled = !state.isSigningOut) {
                    Text(signOutLabel)
                }
                Spacer(Modifier.height(contentPadding.calculateBottomPadding() + 24.dp))
            }
        }
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is android.content.ContextWrapper -> baseContext.findActivity()
    else -> null
}

private fun Context.canPostNotifications(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
