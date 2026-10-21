package org.trustroots.android.ui.editprofile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.NativeBackButton
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.common.rememberFormCancel
import org.trustroots.android.ui.common.resolveFailureMessage

@Composable
internal fun EditProfileScreen(
    api: MobileApiClient,
    session: MemberSession,
    profile: MemberProfile? = null,
    onSessionInvalidated: () -> Unit,
    onCancel: () -> Unit,
    onSaved: (MemberProfile) -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
    username: String = requireNotNull(profile) { "A username or canonical profile is required." }.username,
) {
    val viewModel = rememberEditProfileViewModel(api, session, username, profile)
    val state by viewModel.state.collectAsState()
    val editProfileTitle = stringResource(R.string.screen_edit_profile)
    val languageLocale = LocalConfiguration.current.locales[0]
    var languageMenu by remember { mutableStateOf(false) }
    val options = remember(state.languages, languageLocale) {
        (listOf("eng", "por", "spa", "fra", "deu", "ita", "nld", "rus", "ara", "zho", "hin", "jpn", "tur", "pol", "swe", "ukr") + state.languages)
            .distinct().sortedBy { languageName(it, languageLocale) }
    }
    val cancel = rememberFormCancel(state.isDirty, state.isSaving, onCancel)
    LaunchedEffect(state.pendingInvalidation?.id) {
        state.pendingInvalidation?.let { pending ->
            onSessionInvalidated()
            viewModel.onEvent(EditProfileEvent.InvalidationDelivered(pending.id))
        }
    }
    LaunchedEffect(state.pendingSave?.id) {
        state.pendingSave?.let { pending ->
            onSaved(pending.profile)
            viewModel.onEvent(EditProfileEvent.SaveDelivered(pending.id))
        }
    }

    if (state.baseline == null) {
        Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
            if (state.isLoading) {
                FormActionBar(editProfileTitle, false, false, onCancel, {}, horizontalInset = contentPadding.horizontalInset())
                CircularProgressIndicator(Modifier.padding(20.dp))
            } else {
                NativeBackButton(onCancel)
                state.failure?.let {
                    Text(
                        resolveFailureMessage(UiFailure(it.serverMessage, it.apiKind, it.fallback)),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 20.dp).padding(contentPadding.horizontalInset()),
                    )
                }
            }
        }
        return
    }

    val languagesLabel = stringResource(R.string.screen_languages)
    val chooseLanguagesLabel = stringResource(R.string.screen_choose_languages)
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar(
            editProfileTitle,
            state.isSaving,
            state.name.isNotBlank(),
            cancel,
            { viewModel.onEvent(EditProfileEvent.Save) },
            horizontalInset = contentPadding.horizontalInset(),
        )
        state.failure?.let {
            Text(
                resolveFailureMessage(UiFailure(it.serverMessage, it.apiKind, it.fallback)),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(contentPadding.horizontalInset()).padding(vertical = 8.dp),
            )
        }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState())
                .padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset()),
        ) {
            TextField(state.name, { viewModel.onEvent(EditProfileEvent.NameChanged(it)) }, enabled = !state.isSaving,
                label = { Text(stringResource(R.string.form_name)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
            TextField(state.tagline, { viewModel.onEvent(EditProfileEvent.TaglineChanged(it)) }, enabled = !state.isSaving,
                label = { Text(stringResource(R.string.form_tagline)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
            TextField(state.living, { viewModel.onEvent(EditProfileEvent.LivingChanged(it)) }, enabled = !state.isSaving,
                label = { Text(stringResource(R.string.form_lives_in)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
            TextField(state.from, { viewModel.onEvent(EditProfileEvent.FromChanged(it)) }, enabled = !state.isSaving,
                label = { Text(stringResource(R.string.form_from)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
            Text(languagesLabel, modifier = Modifier.padding(top = 12.dp))
            Box {
                Surface(
                    onClick = { languageMenu = true }, enabled = !state.isSaving, shape = MaterialTheme.shapes.small,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline), modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (state.languages.isEmpty()) chooseLanguagesLabel
                            else state.languages.sortedBy { languageName(it, languageLocale) }.joinToString { languageName(it, languageLocale) },
                            modifier = Modifier.weight(1f),
                        )
                        Icon(Icons.Default.Edit, contentDescription = null)
                    }
                }
                DropdownMenu(expanded = languageMenu, onDismissRequest = { languageMenu = false }) {
                    options.forEach { code ->
                        DropdownMenuItem(
                            text = { Text("${if (code in state.languages) "✓ " else ""}${languageName(code, languageLocale)}") },
                            onClick = { viewModel.onEvent(EditProfileEvent.LanguageToggled(code)) },
                        )
                    }
                }
            }
            TextField(
                state.description,
                { viewModel.onEvent(EditProfileEvent.DescriptionChanged(it)) },
                enabled = !state.isSaving,
                label = { Text(stringResource(R.string.form_about_me)) },
                minLines = 5,
                maxLines = 12,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
        }
    }
}
