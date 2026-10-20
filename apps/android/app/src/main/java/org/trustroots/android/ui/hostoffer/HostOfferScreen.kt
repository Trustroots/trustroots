package org.trustroots.android.ui.hostoffer

import android.text.Html
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.R
import org.trustroots.android.api.HostOfferUpdate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.rememberFormCancel

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
                original = HostOfferUpdate(offerId, status, description, noOfferDescription, maxGuests, showOnlyInMyCircles, latitude, longitude)
                loading = false
            }.onFailure {
                if (it.isAuthenticationFailure()) onSessionInvalidated()
                else {
                    error = it.messageOr("Could not load hosting offer.")
                    loading = false
                }
            }
        }.onFailure {
            if (it.isAuthenticationFailure()) onSessionInvalidated()
            else {
                error = it.messageOr("Could not load hosting offer.")
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
                        savedMessage = "Hosting offer saved."
                    }.onFailure {
                        if (it.isAuthenticationFailure()) onSessionInvalidated()
                        else error = it.messageOr("Could not save hosting offer.")
                    }
                    saving = false
                }
            }
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar("Host", saving, !loading && !descriptionTooShort, cancel, save, horizontalInset = contentPadding.horizontalInset())
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()).testTag("hostOfferScreen")) {
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

        if (saving) CircularProgressIndicator(modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
    }
}
