package org.trustroots.android

import android.os.Bundle
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import org.trustroots.android.ui.TrustrootsApp
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.updates.ApkUpdateAlerts
import org.trustroots.android.notifications.MessageAlerts

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MessageAlerts.captureIntent(intent)
        ApkUpdateAlerts.reconcile(this)
        enableEdgeToEdge()
        setContent {
            TrustrootsTheme {
                TrustrootsApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        MessageAlerts.captureIntent(intent)
    }
}
