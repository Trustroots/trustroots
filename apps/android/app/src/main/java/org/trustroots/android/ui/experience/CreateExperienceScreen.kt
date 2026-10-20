package org.trustroots.android.ui.experience

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.R
import org.trustroots.android.api.ExperienceCreate
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.messageOr
import org.trustroots.android.ui.common.rememberFormCancel

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
                            else error = it.messageOr("Could not share experience.")
                        }
                    saving = false
                }
            }
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar("Experience with $memberLabel", saving, canSave, cancel, save, horizontalInset = contentPadding.horizontalInset())
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()).testTag("createExperienceScreen")) {
        Text("What happened?", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(enabled = !saving, checked = met, onCheckedChange = { met = it })
            Text("We met in person")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(enabled = !saving, checked = hosted, onCheckedChange = { hosted = it })
            Text("I hosted them")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(enabled = !saving, checked = wasGuest, onCheckedChange = { wasGuest = it })
            Text("I was their guest")
        }
        Text("Would you recommend them?", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row {
            listOf("yes" to "Yes", "unknown" to "Not sure", "no" to "No").forEach { (value, label) ->
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
