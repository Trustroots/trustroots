package org.trustroots.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import org.trustroots.android.ui.TrustrootsApp
import org.trustroots.android.ui.theme.TrustrootsTheme
import org.trustroots.android.updates.ApkUpdateAlerts

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ApkUpdateAlerts.reconcile(this)
        enableEdgeToEdge()
        setContent {
            TrustrootsTheme {
                TrustrootsApp()
            }
        }
    }
}
