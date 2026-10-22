package org.trustroots.android.ui.signin

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import org.trustroots.android.R
import org.trustroots.android.ui.common.resolveFailureMessage
import org.trustroots.android.analytics.UsageAnalytics
import org.trustroots.android.api.MemberSession
import org.trustroots.android.ui.common.UsageAnalyticsSettings
import org.trustroots.android.ui.common.rememberBuildDate

@Composable
internal fun SignInScreen(
    analytics: UsageAnalytics,
    viewModel: SignInViewModel,
    onSignedIn: (MemberSession) -> Unit,
    onSignUp: () -> Unit,
    onForgotPassword: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val buildDate = rememberBuildDate()
    val pendingSuccess = state.pendingSuccess

    androidx.compose.runtime.LaunchedEffect(pendingSuccess?.id) {
        val success = pendingSuccess ?: return@LaunchedEffect
        viewModel.onEvent(SignInEvent.SuccessDelivered(success.id))
        onSignedIn(success.session)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.primaryContainer)
            .safeDrawingPadding()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, top = 72.dp, end = 24.dp, bottom = 72.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top,
        ) {
            Image(
                painter = painterResource(R.drawable.trustroots_logo),
                contentDescription = stringResource(R.string.screen_brand_name),
                modifier = Modifier.size(156.dp),
            )
            Text(stringResource(R.string.screen_travellers_community), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(R.string.screen_sign_in_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(28.dp))
            TextField(
                value = state.username,
                onValueChange = { viewModel.onEvent(SignInEvent.UsernameChanged(it)) },
                label = { Text(stringResource(R.string.form_username_or_email)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).testTag("signin-username"),
            )
            TextField(
                value = state.password,
                onValueChange = { viewModel.onEvent(SignInEvent.PasswordChanged(it)) },
                label = { Text(stringResource(R.string.form_password)) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { viewModel.onEvent(SignInEvent.Submit) }),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).testTag("signin-password"),
            )
            state.error?.let {
                Text(
                    resolveFailureMessage(it),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                )
            }
            Button(
                onClick = { viewModel.onEvent(SignInEvent.Submit) },
                enabled = !state.isLoading && state.pendingSuccess == null &&
                    state.username.isNotBlank() && state.password.isNotBlank(),
                modifier = Modifier.fillMaxWidth().padding(top = 18.dp),
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text(stringResource(R.string.screen_sign_in))
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                TextButton(
                    onClick = onSignUp,
                ) { Text(stringResource(R.string.screen_join)) }
                TextButton(
                    onClick = onForgotPassword,
                ) { Text(stringResource(R.string.screen_forgot_password)) }
            }
            Spacer(Modifier.height(20.dp))
            UsageAnalyticsSettings(analytics)
            Text(
                stringResource(R.string.screen_build_date, buildDate),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.62f),
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}
