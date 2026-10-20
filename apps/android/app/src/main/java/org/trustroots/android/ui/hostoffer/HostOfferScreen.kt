@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.hostoffer

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.rememberFormCancel
import org.trustroots.android.ui.common.FormActionBar
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
