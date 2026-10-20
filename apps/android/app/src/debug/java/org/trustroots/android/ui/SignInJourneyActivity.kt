package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import org.trustroots.android.ui.theme.TrustrootsTheme

class SignInJourneyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        val apiBaseUrl = requireNotNull(intent.getStringExtra(API_BASE_URL_EXTRA))
        setContent {
            TrustrootsTheme {
                TrustrootsApp(apiBaseUrl = apiBaseUrl, reconcileAlerts = { _, _ -> })
            }
        }
    }

    companion object {
        const val API_BASE_URL_EXTRA = "org.trustroots.android.test.API_BASE_URL"
    }
}
