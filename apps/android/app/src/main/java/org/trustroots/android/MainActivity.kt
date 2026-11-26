package org.trustroots.android

import android.os.Bundle
import android.content.Intent
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.notifications.NostranslationAlerts
import org.trustroots.android.ui.TrustrootsApp
import org.trustroots.android.ui.signin.BrowserSignInLinks
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.updates.ApkUpdateAlerts

open class MainActivity : ComponentActivity() {
    protected open val apiBaseUrl: String get() = BuildConfig.API_BASE_URL
    private val browserSignInLinks by viewModels<BrowserSignInLinks>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        browserSignInLinks.capture(intent)
        MessageAlerts.captureIntent(intent)
        NostranslationAlerts.captureIntent(intent)
        ApkUpdateAlerts.reconcile(this)
        applyAppearance()
        val backend = apiBaseUrl
        setContent {
            TrustrootsTheme {
                TrustrootsApp(apiBaseUrl = backend)
            }
        }
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        applyAppearance()
    }

    private fun applyAppearance() {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(
                lightScrim = getColor(R.color.trustroots_light_bar_scrim),
                darkScrim = getColor(R.color.trustroots_dark_bar_scrim),
            ),
            navigationBarStyle = SystemBarStyle.auto(
                lightScrim = getColor(R.color.trustroots_light_bar_scrim),
                darkScrim = getColor(R.color.trustroots_dark_bar_scrim),
            ),
        )
        window.setBackgroundDrawableResource(R.color.trustroots_background)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (browserSignInLinks.capture(intent)) return
        setIntent(intent)
        MessageAlerts.captureIntent(intent)
        NostranslationAlerts.captureIntent(intent)
    }
}
