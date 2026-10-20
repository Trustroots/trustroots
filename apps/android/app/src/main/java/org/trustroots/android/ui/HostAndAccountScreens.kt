package org.trustroots.android.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.text.Html
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.R
import org.trustroots.android.api.ExperienceCreate
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.BuildConfig
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.updates.ApkUpdateCheckResult
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.rememberFormCancel
import org.trustroots.android.ui.common.rememberFormLeave
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.messageOr

private const val defaultHostLatitude = 48.6908333333
private const val defaultHostLongitude = 9.14055555556

@Composable
internal fun HostOfferScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val hostOfferLoadError = stringResource(R.string.screen_host_offer_load_error)
    val hostOfferSaveError = stringResource(R.string.screen_host_offer_save_error)
    val hostOfferSaved = stringResource(R.string.screen_host_offer_saved)
    val hostTitle = stringResource(R.string.screen_host)
    val hostDescriptionPrompt = stringResource(R.string.screen_host_description_prompt)
    val availabilityLabel = stringResource(R.string.screen_availability)
    val yesLabel = stringResource(R.string.screen_yes)
    val maybeLabel = stringResource(R.string.screen_maybe)
    val noLabel = stringResource(R.string.screen_no)
    val showOnlyMyCircles = stringResource(R.string.screen_show_only_my_circles)
    val longerHostingDescription = stringResource(R.string.screen_longer_hosting_description)
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var savedMessage by remember { mutableStateOf<String?>(null) }
    var offerId by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("yes") }
    var description by remember { mutableStateOf("") }
    var noOfferDescription by remember { mutableStateOf("") }
    var maxGuests by remember { mutableIntStateOf(1) }
    var showOnlyInMyCircles by remember { mutableStateOf(false) }
    var latitude by remember { mutableStateOf(defaultHostLatitude) }
    var longitude by remember { mutableStateOf(defaultHostLongitude) }
    val scope = rememberCoroutineScope()
    var original by remember { mutableStateOf<HostOfferUpdate?>(null) }
    val currentOffer = HostOfferUpdate(offerId, status, description, noOfferDescription, maxGuests, showOnlyInMyCircles, latitude, longitude)
    LaunchedEffect(session.member.username) {
        loading = true
        error = null
        api.profile(session, session.member.username).onSuccess { profile ->
            val memberID = profile.id
            if (memberID == null) {
                error = hostOfferLoadError
                loading = false
                return@onSuccess
            }
            api.accommodationOffer(session, memberID).onSuccess { offer ->
                if (offer != null) {
                    offerId = offer.id
                    status = offer.status ?: "yes"
                    description = Html.fromHtml(offer.description.orEmpty(), Html.FROM_HTML_MODE_COMPACT)
                        .toString().trim()
                    noOfferDescription = Html.fromHtml(
                        offer.noOfferDescription.orEmpty(),
                        Html.FROM_HTML_MODE_COMPACT,
                    ).toString().trim()
                    maxGuests = offer.maxGuests ?: 1
                    showOnlyInMyCircles = offer.showOnlyInMyCircles
                    latitude = offer.latitude ?: defaultHostLatitude
                    longitude = offer.longitude ?: defaultHostLongitude
                }
                original = HostOfferUpdate(offerId, status, description, noOfferDescription, maxGuests, showOnlyInMyCircles, latitude, longitude)
                loading = false
            }.onFailure {
                if (it.isAuthenticationFailure()) onSessionInvalidated()
                else {
                    error = it.messageOr(hostOfferLoadError)
                    loading = false
                }
            }
        }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else {
                error = it.messageOr(hostOfferLoadError)
                loading = false
            }
        }
    }
    val descriptionTooShort = status != "no" && description.trim().length < 5
    val cancel = rememberFormCancel(!loading && original != null && currentOffer != original, saving, onBack)
    val save: () -> Unit = {
                scope.launch {
                    saving = true
                    error = null
                    savedMessage = null
                    api.saveHostOffer(
                        session,
                        HostOfferUpdate(
                            id = offerId,
                            status = status,
                            description = description,
                            noOfferDescription = noOfferDescription,
                            maxGuests = maxGuests,
                            showOnlyInMyCircles = showOnlyInMyCircles,
                            latitude = latitude,
                            longitude = longitude,
                        ),
                    ).onSuccess { saved ->
                        offerId = saved.id
                        original = currentOffer.copy(id = saved.id)
                        savedMessage = hostOfferSaved
                    }.onFailure {
                        if (it.isAuthenticationFailure()) onSessionInvalidated()
                        else error = it.messageOr(hostOfferSaveError)
                    }
                    saving = false
                }
            }
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar(hostTitle, saving, !loading && !descriptionTooShort, cancel, save, horizontalInset = contentPadding.horizontalInset())
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()).testTag("hostOfferScreen")) {
        Text(
            hostDescriptionPrompt,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        when {
            loading -> CircularProgressIndicator()
            else -> {
        Text(availabilityLabel, style = MaterialTheme.typography.titleMedium)
        Row(Modifier.padding(vertical = 8.dp)) {
            listOf("yes" to yesLabel, "maybe" to maybeLabel, "no" to noLabel).forEach { (value, label) ->
                FilterChip(
                    enabled = !saving,
                    selected = status == value,
                    onClick = { status = value },
                    label = { Text(label) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
        if (status != "no") {
            TextField(
                description,
                { description = it },
                enabled = !saving, label = { Text(stringResource(R.string.form_hosting_description)) },
                minLines = 4,
                maxLines = 10,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            )
            TextField(
                maxGuests.toString(),
                {
                    maxGuests = it.filter(Char::isDigit).toIntOrNull()?.coerceIn(1, 20) ?: maxGuests
                },
                enabled = !saving, label = { Text(stringResource(R.string.form_maximum_guests)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            )
        } else {
            TextField(
                noOfferDescription,
                { noOfferDescription = it },
                enabled = !saving, label = { Text(stringResource(R.string.form_not_hosting_reason)) },
                minLines = 3,
                maxLines = 8,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
            Checkbox(enabled = !saving, checked = showOnlyInMyCircles, onCheckedChange = { showOnlyInMyCircles = it })
            Text(showOnlyMyCircles)
        }
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }
        savedMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
        }
        if (descriptionTooShort) {
            Text(
                longerHostingDescription,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        if (saving) CircularProgressIndicator(modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
    }
}

@Composable
internal fun CreateExperienceScreen(
    api: MobileApiClient,
    session: MemberSession,
    memberID: String,
    memberLabel: String,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    onCreated: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val experienceShareError = stringResource(R.string.screen_experience_share_error)
    val experienceTitle = stringResource(R.string.screen_experience_with, memberLabel)
    val whatHappenedLabel = stringResource(R.string.screen_what_happened)
    val metInPersonLabel = stringResource(R.string.screen_met_in_person)
    val hostedThemLabel = stringResource(R.string.screen_hosted_them)
    val wasTheirGuestLabel = stringResource(R.string.screen_was_their_guest)
    val recommendThemLabel = stringResource(R.string.screen_recommend_them)
    val yesLabel = stringResource(R.string.screen_yes)
    val notSureLabel = stringResource(R.string.screen_not_sure)
    val noLabel = stringResource(R.string.screen_no)
    var met by remember { mutableStateOf(true) }
    var hosted by remember { mutableStateOf(false) }
    var wasGuest by remember { mutableStateOf(false) }
    var recommendation by remember { mutableStateOf("yes") }
    var feedback by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val canSave = met || hosted || wasGuest
    val cancel = rememberFormCancel(!met || hosted || wasGuest || recommendation != "yes" || feedback.isNotEmpty(), saving, onBack)
    val save: () -> Unit = {
                scope.launch {
                    saving = true
                    error = null
                    api.createExperience(
                        session,
                        ExperienceCreate(
                            userTo = memberID,
                            met = met,
                            guest = wasGuest,
                            host = hosted,
                            recommend = recommendation,
                            feedbackPublic = feedback,
                        ),
                    ).onSuccess { onCreated() }
                        .onFailure {
                            if (it.isAuthenticationFailure()) onSessionInvalidated()
                            else error = it.messageOr(experienceShareError)
                        }
                    saving = false
                }
            }
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar(experienceTitle, saving, canSave, cancel, save, horizontalInset = contentPadding.horizontalInset())
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()).testTag("createExperienceScreen")) {
        Text(whatHappenedLabel, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(enabled = !saving, checked = met, onCheckedChange = { met = it })
            Text(metInPersonLabel)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(enabled = !saving, checked = hosted, onCheckedChange = { hosted = it })
            Text(hostedThemLabel)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(enabled = !saving, checked = wasGuest, onCheckedChange = { wasGuest = it })
            Text(wasTheirGuestLabel)
        }
        Text(recommendThemLabel, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row {
            listOf("yes" to yesLabel, "unknown" to notSureLabel, "no" to noLabel).forEach { (value, label) ->
                FilterChip(
                    enabled = !saving,
                    selected = recommendation == value,
                    onClick = { recommendation = value },
                    label = { Text(label) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
        TextField(
            feedback,
            { feedback = it },
            enabled = !saving, label = { Text(stringResource(R.string.form_public_experience_optional)) },
            minLines = 4,
            maxLines = 10,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }

    }
    }
}

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
    val couldNotChooseDistributor = stringResource(R.string.screen_could_not_choose_push_distributor)
    val allowMessageNotifications = stringResource(R.string.screen_allow_message_notifications)
    val latestAndroidPreview = stringResource(R.string.screen_latest_android_preview)
    val uiLocale = androidx.compose.ui.platform.LocalConfiguration.current.locales[0]
    val updateAvailableFormat = stringResource(R.string.screen_update_available)
    val updateCheckError = stringResource(R.string.screen_update_check_error)
    val allowUpdateNotifications = stringResource(R.string.screen_allow_update_notifications)
    val updateAlertsOff = stringResource(R.string.screen_update_alerts_off)
    val accountLoadError = stringResource(R.string.screen_account_load_error)
    val accountSaveError = stringResource(R.string.screen_account_save_error)
    val passwordChangeError = stringResource(R.string.screen_password_change_error)
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
    val messageAlertsOff = stringResource(R.string.screen_message_alerts_off)
    val turnOffMessageAlerts = stringResource(R.string.screen_turn_off_message_alerts)
    val turnOnMessageAlerts = stringResource(R.string.screen_turn_on_message_alerts)
    val signOutLabel = stringResource(R.string.screen_sign_out)
    val savingLabel = stringResource(R.string.saving)
    val changingLabel = stringResource(R.string.screen_changing_password)
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
        if (activity == null) messageAlertStatus = couldNotChooseDistributor
        else enableMessageAlerts(activity, session) {
            messageAlertStatus = it
            messageAlertsEnabled = MessageAlerts.isEnabled(context, session.member.username)
        }
    }
    val messagePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startMessageAlerts()
        else messageAlertStatus = allowMessageNotifications
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
                            updateStatus = latestAndroidPreview
                            updateReleaseUrl = null
                        }
                        is ApkUpdateCheckResult.NewVersion -> {
                            updateStatus = String.format(uiLocale, updateAvailableFormat, result.release.versionName)
                            updateReleaseUrl = result.release.pageUrl
                        }
                        ApkUpdateCheckResult.Unavailable -> {
                            updateStatus = updateCheckError
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
            updateStatus = allowUpdateNotifications
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
                error = it.messageOr(accountLoadError)
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
        Text(accountTitle, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
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
                        updateStatus = updateAlertsOff
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
        Text(emailLabel, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
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
            Text(newsletterLabel)
        }
        details?.emailTemporary?.let {
            Text(
                String.format(uiLocale, emailConfirmationPending, it),
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
                        message = accountSaved
                    }.onFailure {
                        if (it.isAuthenticationFailure()) onSessionInvalidated()
                        else error = it.messageOr(accountSaveError)
                    }
                    savingAccount = false
                }
            },
            enabled = !savingAccount && email.isNotBlank(),
            modifier = Modifier.padding(top = 8.dp),
        ) { Text(if (savingAccount) savingLabel else saveEmailSettings) }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Text(changePasswordLabel, style = MaterialTheme.typography.titleMedium)
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
                            message = passwordChanged
                        }
                        .onFailure {
                            if (it.isAuthenticationFailure()) onSessionInvalidated()
                            else error = it.messageOr(passwordChangeError)
                        }
                    changingPassword = false
                }
            },
            enabled = !changingPassword &&
                currentPassword.isNotBlank() &&
                newPassword.isNotBlank() &&
                newPassword == verifyPassword,
            modifier = Modifier.padding(top = 8.dp),
        ) { Text(if (changingPassword) changingLabel else changePasswordLabel) }
        TextButton(onClick = { leave(onResetPassword) }) { Text(forgotYourPassword) }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Text(messageAlertsTitle, style = MaterialTheme.typography.titleMedium)
        Text(messageAlertsDescription)
        Button(onClick = {
            if (messageAlertsEnabled) {
                scope.launch {
                    disableMessageAlerts(context, session)
                    messageAlertsEnabled = false
                    messageAlertStatus = messageAlertsOff
                }
            } else if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                messagePermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else startMessageAlerts()
        }) { Text(if (messageAlertsEnabled) turnOffMessageAlerts else turnOnMessageAlerts) }
        (distributorStatus ?: messageAlertStatus)?.let { Text(it) }
        message?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 10.dp))
        }
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp))
        }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Button(onClick = { leave(onSignedOut) }) { Text(signOutLabel) }
        Spacer(Modifier.height(24.dp))
            }
        }
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
    Text(stringResource(R.string.screen_apk_updates), style = MaterialTheme.typography.titleMedium)
    Text(
        stringResource(R.string.screen_apk_updates_description),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 6.dp),
    )
    Button(onClick = onToggle, modifier = Modifier.padding(top = 12.dp)) {
        Text(stringResource(if (enabled) R.string.screen_turn_off_update_alerts else R.string.screen_turn_on_update_alerts))
    }
    if (enabled) {
        TextButton(onClick = onCheck, enabled = !checking) {
            Text(stringResource(if (checking) R.string.screen_checking_updates else R.string.screen_check_updates_now))
        }
    }
    status?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    releaseUrl?.let { url ->
        TextButton(onClick = { onOpenRelease(url) }) { Text(stringResource(R.string.screen_open_release_page)) }
    }
}
