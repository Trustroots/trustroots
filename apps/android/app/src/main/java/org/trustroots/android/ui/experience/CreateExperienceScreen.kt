@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package org.trustroots.android.ui.experience

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TextField
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.LabelledCheckbox
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.rememberFormCancel
import org.trustroots.android.ui.common.resolveFailureMessage

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
    val viewModel = rememberCreateExperienceViewModel(api, session, memberID)
    val state by viewModel.state.collectAsState()
    val experienceTitle = stringResource(R.string.screen_experience_with, memberLabel)
    val whatHappenedLabel = stringResource(R.string.screen_what_happened)
    val metInPersonLabel = stringResource(R.string.screen_met_in_person)
    val hostedThemLabel = stringResource(R.string.screen_hosted_them)
    val wasTheirGuestLabel = stringResource(R.string.screen_was_their_guest)
    val recommendThemLabel = stringResource(R.string.screen_recommend_them)
    val yesLabel = stringResource(R.string.screen_yes)
    val notSureLabel = stringResource(R.string.screen_not_sure)
    val noLabel = stringResource(R.string.screen_no)
    val cancel = rememberFormCancel(state.isDirty, state.isSaving, onBack)
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    LaunchedEffect(state.pendingInvalidation?.id) {
        state.pendingInvalidation?.let { pending ->
            onSessionInvalidated()
            viewModel.onEvent(CreateExperienceEvent.InvalidationDelivered(pending.id))
        }
    }
    LaunchedEffect(state.pendingSuccess?.id) {
        state.pendingSuccess?.let { pending ->
            onCreated()
            viewModel.onEvent(CreateExperienceEvent.SuccessDelivered(pending.id))
        }
    }
    Scaffold(
        modifier = Modifier.fillMaxSize().imePadding().nestedScroll(scrollBehavior.nestedScrollConnection),
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            FormActionBar(experienceTitle, state.isSaving, state.canSave, cancel, { viewModel.onEvent(CreateExperienceEvent.Submit) }, contentPadding = contentPadding, scrollBehavior = scrollBehavior)
        },
    ) { appBarPadding ->
        Column(Modifier.fillMaxSize().padding(appBarPadding)) {
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState())
                .padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()).testTag("createExperienceScreen"),
        ) {
                Text(whatHappenedLabel, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        LabelledCheckbox(
            label = metInPersonLabel,
            checked = state.met,
            enabled = !state.isSaving,
            onCheckedChange = { viewModel.onEvent(CreateExperienceEvent.MetChanged(it)) },
        )
        LabelledCheckbox(
            label = hostedThemLabel,
            checked = state.hosted,
            enabled = !state.isSaving,
            onCheckedChange = { viewModel.onEvent(CreateExperienceEvent.HostedChanged(it)) },
        )
        LabelledCheckbox(
            label = wasTheirGuestLabel,
            checked = state.wasGuest,
            enabled = !state.isSaving,
            onCheckedChange = { viewModel.onEvent(CreateExperienceEvent.WasGuestChanged(it)) },
        )
        Text(recommendThemLabel, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        Row {
            listOf("yes" to yesLabel, "unknown" to notSureLabel, "no" to noLabel).forEach { (value, label) ->
                FilterChip(
                    enabled = !state.isSaving,
                    selected = state.recommendation == value,
                    onClick = { viewModel.onEvent(CreateExperienceEvent.RecommendationChanged(value)) },
                    label = { Text(label) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
        TextField(
            state.feedback,
            { viewModel.onEvent(CreateExperienceEvent.FeedbackChanged(it)) },
            enabled = !state.isSaving, label = { Text(stringResource(R.string.form_public_experience_optional)) },
            minLines = 4,
            maxLines = 10,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        state.failure?.let {
            Text(resolveFailureMessage(UiFailure(it.serverMessage, it.apiKind, UiFailureFallback.SHARE_EXPERIENCE)), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
        }

    }
        }
    }
}
