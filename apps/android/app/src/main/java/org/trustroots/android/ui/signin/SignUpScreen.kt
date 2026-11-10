package org.trustroots.android.ui.signin

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.ui.common.LabelledCheckbox
import org.trustroots.android.ui.common.PinnedTopAppBar
import org.trustroots.android.ui.common.rememberBuildDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SignUpScreen(
    form: SignUpViewModel,
    api: MobileApiClient,
    onBack: () -> Unit,
    onRules: () -> Unit,
    onSignedUp: (MemberSession) -> Unit,
) {
    val session = form.session
    LaunchedEffect(session) { session?.let(onSignedUp) }
    BackHandler(enabled = form.isBusy || session != null) {}
    val editable = !form.isBusy && !form.accountCreated
    val locale = LocalConfiguration.current.locales[0].toLanguageTag()
    Scaffold(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().imePadding(),
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            PinnedTopAppBar(
                title = stringResource(R.string.screen_join_trustroots),
                scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(),
                contentPadding = PaddingValues.Zero,
                onBack = onBack.takeUnless { form.isBusy || session != null },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SignUpField(R.string.signup_first_name, "first-name", form.firstName, editable, { form.firstName = it })
            SignUpField(R.string.signup_last_name, "last-name", form.lastName, editable, { form.lastName = it })
            SignUpField(R.string.signup_username, "username", form.username, editable, { form.username = it })
            SignUpField(
                R.string.form_email_address, "email", form.email, editable,
                { form.email = it }, KeyboardType.Email,
            )
            SignUpField(
                R.string.signup_password, "password", form.password, editable,
                { form.password = it }, KeyboardType.Password,
            )
            SignUpField(
                R.string.signup_acquisition, "acquisition", form.acquisitionStory, editable,
                { form.acquisitionStory = it.take(500) },
            )
            LabelledCheckbox(
                label = stringResource(R.string.signup_newsletter),
                checked = form.newsletter,
                enabled = editable,
                onCheckedChange = { form.newsletter = it },
            )
            LabelledCheckbox(
                label = stringResource(R.string.signup_age),
                checked = form.ageConfirmed,
                enabled = editable,
                onCheckedChange = { form.ageConfirmed = it },
            )
            Text(stringResource(R.string.signup_rules_agreement))
            TextButton(onClick = onRules, enabled = editable) { Text(stringResource(R.string.signup_read_rules)) }
            val failure = form.serverError ?: form.error?.let { stringResource(it) }
            failure?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(
                onClick = { form.submit(api, locale) },
                enabled = form.canSubmit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                val label = when {
                    form.isBusy -> R.string.signup_working
                    form.accountCreated -> R.string.retry
                    else -> R.string.signup_create_account
                }
                Text(stringResource(label))
            }
            Text(
                stringResource(R.string.screen_build_date, rememberBuildDate()),
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun SignUpField(
    label: Int,
    tag: String,
    value: String,
    enabled: Boolean,
    onChange: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    TextField(
        value = value,
        onValueChange = onChange,
        enabled = enabled,
        label = { Text(stringResource(label)) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (keyboardType == KeyboardType.Password) {
            PasswordVisualTransformation()
        } else {
            VisualTransformation.None
        },
        modifier = Modifier.fillMaxWidth().testTag("signup-$tag"),
    )
}
