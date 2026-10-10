package org.trustroots.android.ui

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.text.Html
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.api.AccountDetails
import org.trustroots.android.api.ExperienceCreate
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileApiException
import org.trustroots.android.notifications.MessageAlerts

private const val defaultHostLatitude = 48.6908333333
private const val defaultHostLongitude = 9.14055555556

@Composable
internal fun HostOfferScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
) {
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
    LaunchedEffect(session.member.username) {
        loading = true
        error = null
        api.profile(session, session.member.username).onSuccess { profile ->
            val memberID = profile.id
            if (memberID == null) {
                error = "Could not load hosting offer."
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
                loading = false
            }.onFailure {
                if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                else {
                    error = it.message ?: "Could not load hosting offer."
                    loading = false
                }
            }
        }.onFailure {
            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
            else {
                error = it.message ?: "Could not load hosting offer."
                loading = false
            }
        }
    }
    val descriptionTooShort = status != "no" && description.trim().length < 5
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
            .testTag("hostOfferScreen"),
    ) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Text("Host", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "Tell travellers whether you can host.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        when {
            loading -> CircularProgressIndicator()
            else -> {
        Text("Availability", style = MaterialTheme.typography.titleMedium)
        Row(Modifier.padding(vertical = 8.dp)) {
            listOf("yes" to "Yes", "maybe" to "Maybe", "no" to "No").forEach { (value, label) ->
                FilterChip(
                    selected = status == value,
                    onClick = { status = value },
                    label = { Text(label) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
        if (status != "no") {
            OutlinedTextField(
                description,
                { description = it },
                label = { Text("Hosting description") },
                minLines = 4,
                maxLines = 10,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                maxGuests.toString(),
                {
                    maxGuests = it.filter(Char::isDigit).toIntOrNull()?.coerceIn(1, 20) ?: maxGuests
                },
                label = { Text("Maximum guests") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        } else {
            OutlinedTextField(
                noOfferDescription,
                { noOfferDescription = it },
                label = { Text("Why you are not hosting") },
                minLines = 3,
                maxLines = 8,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
            Checkbox(checked = showOnlyInMyCircles, onCheckedChange = { showOnlyInMyCircles = it })
            Text("Show only to members in my circles")
        }
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }
        savedMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
        }
        if (descriptionTooShort) {
            Text(
                "Write a longer hosting description first.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
        Button(
            onClick = {
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
                        savedMessage = "Hosting offer saved."
                    }.onFailure {
                        if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                        else error = it.message ?: "Could not save hosting offer."
                    }
                    saving = false
                }
            },
            enabled = !saving && !descriptionTooShort,
            modifier = Modifier.padding(top = 16.dp).testTag("saveHostOffer"),
        ) { Text(if (saving) "Saving…" else "Save and exit") }
        if (saving) CircularProgressIndicator(modifier = Modifier.padding(top = 12.dp))
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
) {
    var met by remember { mutableStateOf(true) }
    var hosted by remember { mutableStateOf(false) }
    var wasGuest by remember { mutableStateOf(false) }
    var recommendation by remember { mutableStateOf("yes") }
    var feedback by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val canSave = met || hosted || wasGuest
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
            .testTag("createExperienceScreen"),
    ) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Text(
            "Experience with $memberLabel",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text("What happened?", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = met, onCheckedChange = { met = it })
            Text("We met in person")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = hosted, onCheckedChange = { hosted = it })
            Text("I hosted them")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = wasGuest, onCheckedChange = { wasGuest = it })
            Text("I was their guest")
        }
        Text("Would you recommend them?", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row {
            listOf("yes" to "Yes", "unknown" to "Not sure", "no" to "No").forEach { (value, label) ->
                FilterChip(
                    selected = recommendation == value,
                    onClick = { recommendation = value },
                    label = { Text(label) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
        OutlinedTextField(
            feedback,
            { feedback = it },
            label = { Text("Public experience (optional)") },
            minLines = 4,
            maxLines = 10,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }
        Button(
            onClick = {
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
                            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                            else error = it.message ?: "Could not share experience."
                        }
                    saving = false
                }
            },
            enabled = !saving && canSave,
            modifier = Modifier.padding(top = 16.dp).testTag("shareExperience"),
        ) { Text(if (saving) "Sharing…" else "Share") }
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
) {
    val context = LocalContext.current
    var messageAlertsEnabled by remember(session.member.username) {
        mutableStateOf(MessageAlerts.isEnabled(context, session.member.username))
    }
    var messageAlertStatus by remember { mutableStateOf<String?>(null) }
    val distributorStatus by MessageAlerts.status.collectAsState()
    val startMessageAlerts: () -> Unit = {
        val activity = context as? Activity
        if (activity == null) messageAlertStatus = "Could not choose a push distributor."
        else MessageAlerts.enable(activity, session) {
            messageAlertStatus = it
            messageAlertsEnabled = MessageAlerts.isEnabled(context, session.member.username)
        }
    }
    val messagePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startMessageAlerts()
        else messageAlertStatus = "Allow notifications in Android settings to receive message alerts."
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
    val scope = rememberCoroutineScope()
    LaunchedEffect(session.member.username) {
        loading = true
        api.accountDetails(session).onSuccess {
            details = it
            email = it.email
            newsletter = it.newsletter
            loading = false
        }.onFailure {
            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
            else {
                error = it.message ?: "Could not load account."
                loading = false
            }
        }
    }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
            .testTag("accountSettingsScreen"),
    ) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Text("Account", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        UsageAnalyticsSettings()
        Text(
            "Signed in as ${session.member.displayName} (@${session.member.username}).",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
        when {
            loading -> CircularProgressIndicator(modifier = Modifier.padding(top = 20.dp))
            else -> {
        Text("Email", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
        OutlinedTextField(
            email,
            { email = it },
            label = { Text("Email address") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
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
                        if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                        else error = it.message ?: "Could not save account."
                    }
                    savingAccount = false
                }
            },
            enabled = !savingAccount && email.isNotBlank(),
            modifier = Modifier.padding(top = 8.dp),
        ) { Text(if (savingAccount) "Saving…" else "Save email settings") }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Text("Change password", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            currentPassword,
            { currentPassword = it },
            label = { Text("Current password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            newPassword,
            { newPassword = it },
            label = { Text("New password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            verifyPassword,
            { verifyPassword = it },
            label = { Text("Verify new password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
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
                            if ((it as? MobileApiException)?.isAuthenticationFailure == true) onSessionInvalidated()
                            else error = it.message ?: "Could not change password."
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
        TextButton(onClick = onResetPassword) { Text("Forgot your password?") }
        HorizontalDivider(Modifier.padding(vertical = 20.dp))
        Text("Message alerts", style = MaterialTheme.typography.titleMedium)
        Text("Receive an alert for an unread conversation after ten minutes. This requires an installed UnifiedPush distributor, such as ntfy.")
        Button(onClick = {
            if (messageAlertsEnabled) {
                scope.launch {
                    MessageAlerts.disable(context, session)
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
        Button(onClick = onSignedOut) { Text("Sign out") }
        Spacer(Modifier.height(24.dp))
            }
        }
    }
}
