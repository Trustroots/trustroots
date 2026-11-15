package org.trustroots.android

import android.os.Bundle
import android.content.Intent
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import org.trustroots.android.notifications.MessageAlerts
import org.trustroots.android.ui.TrustrootsApp
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.updates.ApkUpdateAlerts

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MessageAlerts.captureIntent(intent)
        ApkUpdateAlerts.reconcile(this)
        applyAppearance()
        setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    sharedMemberPilot = BuildConfig.DEBUG &&
                        intent.getBooleanExtra(SHARED_MEMBER_PILOT_EXTRA, false),
                    onExitSharedMemberPilot = {
                        setIntent(Intent(intent).putExtra(SHARED_MEMBER_PILOT_EXTRA, false))
                    },
                )
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
        setIntent(intent)
        MessageAlerts.captureIntent(intent)
    }

    companion object {
        const val SHARED_MEMBER_PILOT_EXTRA = "org.trustroots.android.debug.SHARED_MEMBER_PILOT"
    }
}
