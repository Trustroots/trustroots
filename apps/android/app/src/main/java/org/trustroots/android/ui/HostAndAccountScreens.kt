@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.api.ExperienceCreate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.R
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.rememberFormCancel
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage

@Composable
internal fun HostOfferScreen(
    api: MobileApiClient,
    session: MemberSession,
    onSessionInvalidated: () -> Unit,
    onBack: () -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val viewModel = rememberHostOfferViewModel(api, session)
    val state by viewModel.state.collectAsState()
    LaunchedEffect(viewModel, state.pendingSessionInvalidation?.id) {
        val pending = state.pendingSessionInvalidation ?: return@LaunchedEffect
        onSessionInvalidated()
        viewModel.onEvent(HostOfferEvent.SessionInvalidationDelivered(pending.id))
    }
    val hostTitle = stringResource(R.string.screen_host)
    val hostDescriptionPrompt = stringResource(R.string.screen_host_description_prompt)
    val availabilityLabel = stringResource(R.string.screen_availability)
    val yesLabel = stringResource(R.string.screen_yes)
    val maybeLabel = stringResource(R.string.screen_maybe)
    val noLabel = stringResource(R.string.screen_no)
    val showOnlyMyCircles = stringResource(R.string.screen_show_only_my_circles)
    val longerHostingDescription = stringResource(R.string.screen_longer_hosting_description)
    val form = state.form
    val cancel = rememberFormCancel(state.isDirty, state.isSaving, onBack)
    val save = { viewModel.onEvent(HostOfferEvent.Save) }
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar(hostTitle, state.isSaving, state.canSave, cancel, save, horizontalInset = contentPadding.horizontalInset())
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()).testTag("hostOfferScreen")) {
        Text(
            hostDescriptionPrompt,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        when {
            state.isLoading -> CircularProgressIndicator()
            state.original == null -> {
                state.failure?.let {
                    Text(resolveFailureMessage(it), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                }
                if (state.failure != null) {
                    TextButton(onClick = { viewModel.onEvent(HostOfferEvent.RetryLoad) }) {
                        Text(stringResource(R.string.retry))
                    }
                }
            }
            else -> {
        Text(availabilityLabel, style = MaterialTheme.typography.titleMedium)
        Row(Modifier.padding(vertical = 8.dp)) {
            listOf("yes" to yesLabel, "maybe" to maybeLabel, "no" to noLabel).forEach { (value, label) ->
                FilterChip(
                    enabled = !state.isSaving,
                    selected = form.status == value,
                    onClick = { viewModel.onEvent(HostOfferEvent.StatusChanged(value)) },
                    label = { Text(label) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
        if (form.status != "no") {
            TextField(
                form.description,
                { viewModel.onEvent(HostOfferEvent.DescriptionChanged(it)) },
                enabled = !state.isSaving, label = { Text(stringResource(R.string.form_hosting_description)) },
                minLines = 4,
                maxLines = 10,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            )
            TextField(
                form.maxGuests.toString(),
                { viewModel.onEvent(HostOfferEvent.MaximumGuestsChanged(it)) },
                enabled = !state.isSaving, label = { Text(stringResource(R.string.form_maximum_guests)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            )
        } else {
            TextField(
                form.noOfferDescription,
                { viewModel.onEvent(HostOfferEvent.NoOfferDescriptionChanged(it)) },
                enabled = !state.isSaving, label = { Text(stringResource(R.string.form_not_hosting_reason)) },
                minLines = 3,
                maxLines = 8,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
            Checkbox(enabled = !state.isSaving, checked = form.showOnlyInMyCircles, onCheckedChange = { viewModel.onEvent(HostOfferEvent.ShowOnlyInMyCirclesChanged(it)) })
            Text(showOnlyMyCircles)
        }
        state.failure?.let {
            Text(resolveFailureMessage(it), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }
        if (state.saveSucceeded) {
            Text(stringResource(R.string.screen_host_offer_saved), color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
        }
        if (state.descriptionTooShort) {
            Text(
                longerHostingDescription,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        if (state.isSaving) CircularProgressIndicator(modifier = Modifier.padding(top = 12.dp))
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
    var error by remember { mutableStateOf<UiFailure?>(null) }
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
                            else error = it.toUiFailure(UiFailureFallback.SHARE_EXPERIENCE)
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
            Text(resolveFailureMessage(it), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
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
