package org.trustroots.android.ui.editprofile

import android.text.Html
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.trustroots.android.api.MemberProfile
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.ProfileUpdate
import org.trustroots.android.R
import org.trustroots.android.ui.common.FormActionBar
import org.trustroots.android.ui.common.horizontalInset
import org.trustroots.android.ui.common.isAuthenticationFailure
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.common.toUiFailure
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.ui.common.rememberFormCancel

@Composable
internal fun EditProfileScreen(
    api: MobileApiClient,
    session: MemberSession,
    profile: MemberProfile,
    onSessionInvalidated: () -> Unit,
    onCancel: () -> Unit,
    onSaved: (MemberProfile) -> Unit,
    contentPadding: PaddingValues = PaddingValues.Zero,
) {
    val editProfileTitle = stringResource(R.string.screen_edit_profile)
    val languagesLabel = stringResource(R.string.screen_languages)
    val chooseLanguagesLabel = stringResource(R.string.screen_choose_languages)
    var name by remember(profile.username) { mutableStateOf(profile.displayName) }
    var tagline by remember(profile.username) { mutableStateOf(profile.tagline.orEmpty()) }
    var description by remember(profile.username) {
        mutableStateOf(Html.fromHtml(profile.description.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim())
    }
    var living by remember(profile.username) { mutableStateOf(profile.locationLiving.orEmpty()) }
    var from by remember(profile.username) { mutableStateOf(profile.locationFrom.orEmpty()) }
    var languages by remember(profile.username) { mutableStateOf(profile.languages.toSet()) }
    var languageMenu by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<UiFailure?>(null) }
    val languageLocale = LocalConfiguration.current.locales[0]
    val scope = rememberCoroutineScope()
    val options = remember(languages, languageLocale) {
        (listOf("eng", "por", "spa", "fra", "deu", "ita", "nld", "rus", "ara", "zho", "hin", "jpn", "tur", "pol", "swe", "ukr") + languages)
            .distinct().sortedBy { languageName(it, languageLocale) }
    }
    val initialDescription = remember(profile.username) { Html.fromHtml(profile.description.orEmpty(), Html.FROM_HTML_MODE_COMPACT).toString().trim() }
    val dirty = name != profile.displayName || tagline != profile.tagline.orEmpty() || description != initialDescription ||
        living != profile.locationLiving.orEmpty() || from != profile.locationFrom.orEmpty() || languages != profile.languages.toSet()
    val cancel = rememberFormCancel(dirty, saving, onCancel)
    val save: () -> Unit = {
                scope.launch {
                    saving = true
                    error = null
                    api.updateProfile(session, ProfileUpdate(name, tagline, description, living, from, languages.toList()))
                        .onSuccess(onSaved)
                        .onFailure {
                            if (it.isAuthenticationFailure()) onSessionInvalidated()
                            else error = it.toUiFailure(UiFailureFallback.SAVE_PROFILE)
                        }
                    saving = false
                }
            }
    Column(Modifier.fillMaxSize().imePadding().padding(top = contentPadding.calculateTopPadding())) {
        FormActionBar(editProfileTitle, saving, name.isNotBlank(), cancel, save, horizontalInset = contentPadding.horizontalInset())
        error?.let {
            Text(
                resolveFailureMessage(it),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(contentPadding.horizontalInset())
                    .padding(vertical = 8.dp),
            )
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = contentPadding.calculateBottomPadding()).padding(20.dp).padding(contentPadding.horizontalInset())) {
        TextField(name, { name = it }, enabled = !saving, label = { Text(stringResource(R.string.form_name)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
        TextField(tagline, { tagline = it }, enabled = !saving, label = { Text(stringResource(R.string.form_tagline)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
        TextField(living, { living = it }, enabled = !saving, label = { Text(stringResource(R.string.form_lives_in)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
        TextField(from, { from = it }, enabled = !saving, label = { Text(stringResource(R.string.form_from)) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
        Text(languagesLabel, modifier = Modifier.padding(top = 12.dp))
        Box {
            Surface(onClick = { languageMenu = true }, enabled = !saving, shape = MaterialTheme.shapes.small, border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (languages.isEmpty()) chooseLanguagesLabel else languages.sortedBy { languageName(it, languageLocale) }.joinToString { languageName(it, languageLocale) }, modifier = Modifier.weight(1f))
                    Icon(Icons.Default.Edit, contentDescription = null)
                }
            }
            DropdownMenu(expanded = languageMenu, onDismissRequest = { languageMenu = false }) {
                options.forEach { code ->
                    DropdownMenuItem(
                        text = { Text("${if (code in languages) "✓ " else ""}${languageName(code, languageLocale)}") },
                        onClick = { languages = if (code in languages) languages - code else languages + code },
                    )
                }
            }
        }
        TextField(
            description, { description = it }, enabled = !saving, label = { Text(stringResource(R.string.form_about_me)) },
            minLines = 5, maxLines = 12, modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        }
    }
}
