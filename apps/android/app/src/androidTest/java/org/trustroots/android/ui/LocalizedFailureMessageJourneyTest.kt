package org.trustroots.android.ui

import android.content.res.Configuration
import android.content.res.Resources
import android.os.LocaleList
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Locale
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.trustroots.android.R
import org.trustroots.android.api.ApiFailureKind
import org.trustroots.android.api.MessageMember
import org.trustroots.android.ui.common.UiFailure
import org.trustroots.android.ui.common.UiFailureFallback
import org.trustroots.android.ui.common.localizedLabel
import org.trustroots.android.ui.common.resolveFailureMessage

@RunWith(AndroidJUnit4::class)
class LocalizedFailureMessageJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun retainedFailureUsesUpdatedLocaleAndUnknownMemberUsesResourceLabel() {
        val activity = compose.activity
        val englishConfiguration = Configuration(activity.resources.configuration).apply {
            setLocales(LocaleList(Locale.ENGLISH))
        }
        val frenchConfiguration = Configuration(activity.resources.configuration).apply {
            setLocales(LocaleList(Locale.FRENCH))
        }
        val english = activity.createConfigurationContext(englishConfiguration)
        val french = activity.createConfigurationContext(frenchConfiguration)
        val englishResources = LocaleOverlayResources(activity.resources, Locale.ENGLISH)
        val frenchResources = LocaleOverlayResources(activity.resources, Locale.FRENCH)

        compose.setContent {
            var useFrench by remember { mutableStateOf(false) }
            val context = if (useFrench) french else english
            val resources = if (useFrench) frenchResources else englishResources
            val retainedFailure = remember {
                UiFailure(apiKind = ApiFailureKind.REQUEST_REJECTED, fallback = UiFailureFallback.LOAD_CONTACTS)
            }
            CompositionLocalProvider(
                LocalContext provides context,
                LocalConfiguration provides context.resources.configuration,
                LocalResources provides resources,
            ) {
                Column {
                    Text(resolveFailureMessage(retainedFailure))
                    Text(resolveFailureMessage(UiFailure(apiKind = ApiFailureKind.SIGN_IN_REJECTED, fallback = UiFailureFallback.REACH_TRUSTROOTS)))
                    Text(resolveFailureMessage(UiFailure(apiKind = ApiFailureKind.MISSING_SESSION, fallback = UiFailureFallback.REACH_TRUSTROOTS)))
                    Text(resolveFailureMessage(UiFailure(fallback = UiFailureFallback.LOAD_CONTACTS)))
                    Text(MessageMember(id = null, username = null, displayName = "").localizedLabel())
                    Button(onClick = { useFrench = true }) { Text("Change language") }
                }
            }
        }

        compose.onNodeWithText("English test request rejection").assertIsDisplayed()
        compose.onNodeWithText("English test sign-in rejection").assertIsDisplayed()
        compose.onNodeWithText("English test missing session").assertIsDisplayed()
        compose.onNodeWithText("Could not load contacts.").assertIsDisplayed()
        compose.onNodeWithText(compose.activity.getString(R.string.profile_photo_default_member_label)).assertIsDisplayed()
        compose.onNodeWithText("Change language").performClick()
        compose.onNodeWithText("French test request rejection").assertIsDisplayed()
        compose.onNodeWithText("French test sign-in rejection").assertIsDisplayed()
        compose.onNodeWithText("French test missing session").assertIsDisplayed()
    }

    @Test
    fun nonblankServerMessageRemainsVerbatimAfterLocaleChange() {
        val activity = compose.activity
        val englishConfiguration = Configuration(activity.resources.configuration).apply {
            setLocales(LocaleList(Locale.ENGLISH))
        }
        val frenchConfiguration = Configuration(activity.resources.configuration).apply {
            setLocales(LocaleList(Locale.FRENCH))
        }
        val english = activity.createConfigurationContext(englishConfiguration)
        val french = activity.createConfigurationContext(frenchConfiguration)
        val englishResources = LocaleOverlayResources(activity.resources, Locale.ENGLISH)
        val frenchResources = LocaleOverlayResources(activity.resources, Locale.FRENCH)

        compose.setContent {
            var useFrench by remember { mutableStateOf(false) }
            val context = if (useFrench) french else english
            val resources = if (useFrench) frenchResources else englishResources
            val retainedFailure = remember {
                UiFailure(
                    serverMessage = "A fictional server response.",
                    apiKind = ApiFailureKind.REQUEST_REJECTED,
                    fallback = UiFailureFallback.LOAD_CONTACTS,
                )
            }
            CompositionLocalProvider(
                LocalContext provides context,
                LocalConfiguration provides context.resources.configuration,
                LocalResources provides resources,
            ) {
                Column {
                    Text(resolveFailureMessage(retainedFailure))
                    Button(onClick = { useFrench = true }) { Text("Change language") }
                }
            }
        }

        compose.onNodeWithText("A fictional server response.").assertIsDisplayed()
        compose.onNodeWithText("Change language").performClick()
        compose.onNodeWithText("A fictional server response.").assertIsDisplayed()
    }
}


internal class LocaleOverlayResources(
    base: Resources,
    locale: Locale,
) : Resources(
    base.assets,
    base.displayMetrics,
    Configuration(base.configuration).apply { setLocales(LocaleList(locale)) },
) {
    private val language = locale.language

    override fun getString(id: Int): String = when (id) {
        R.string.api_request_rejected -> if (language == "fr") "French test request rejection" else "English test request rejection"
        R.string.api_sign_in_rejected -> if (language == "fr") "French test sign-in rejection" else "English test sign-in rejection"
        R.string.api_missing_session -> if (language == "fr") "French test missing session" else "English test missing session"
        R.string.screen_brand_name -> label("Trustroots")
        R.string.screen_travellers_community -> label("travellers’ community")
        R.string.screen_sign_in_description -> label("sharing, hosting and getting people together")
        R.string.form_username_or_email -> label("username or email")
        R.string.form_password -> label("password")
        R.string.screen_sign_in -> label("sign in")
        R.string.screen_join -> label("join")
        R.string.screen_forgot_password -> label("forgot password")
        R.string.screen_join_trustroots -> label("Join Trustroots")
        R.string.screen_reset_password -> label("Reset password")
        else -> super.getString(id)
    }

    override fun getString(id: Int, vararg formatArgs: Any): String = when (id) {
        R.string.screen_build_date -> "${if (language == "fr") "French" else "English"} test build ${formatArgs.firstOrNull()?.toString().orEmpty()}"
        else -> super.getString(id, *formatArgs)
    }

    private fun label(value: String): String =
        "${if (language == "fr") "French" else "English"} test $value"
}
