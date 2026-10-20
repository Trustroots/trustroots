package org.trustroots.android.ui

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import org.trustroots.android.ui.theme.TrustrootsTheme

class SignInJourneyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        val apiBaseUrl = requireNotNull(intent.getStringExtra(API_BASE_URL_EXTRA))
        setContent {
            TrustrootsTheme {
                TrustrootsApp(
                    apiBaseUrl = apiBaseUrl,
                    reconcileAlerts = { _, _ -> },
                    browserContent = if (intent.getBooleanExtra(FAKE_BROWSER_EXTRA, false)) {
                        { route, onClose, contentPadding ->
                            Column(
                                Modifier.fillMaxSize().padding(contentPadding).testTag("offlineBrowserSurface"),
                            ) {
                                Text("Fake browser: ${route.title}")
                                Text(route.url)
                                Text("Runtime session: ${route.sessionCookie.orEmpty()}")
                                TextButton(onClick = onClose) { Text("Close fake browser") }
                            }
                        }
                    } else {
                        if (intent.getStringExtra(PROFILE_BROWSER_URL_EXTRA) != null) {
                            { route, onClose, contentPadding ->
                                org.trustroots.android.browser.DefaultBrowserContent(
                                    route.copy(url = requireNotNull(intent.getStringExtra(PROFILE_BROWSER_URL_EXTRA))),
                                    onClose,
                                    contentPadding,
                                )
                            }
                        } else {
                            org.trustroots.android.browser.DefaultBrowserContent
                        }
                    },
                )
            }
        }
    }

    companion object {
        const val API_BASE_URL_EXTRA = "org.trustroots.android.test.API_BASE_URL"
        const val FAKE_BROWSER_EXTRA = "org.trustroots.android.test.FAKE_BROWSER"
        const val PROFILE_BROWSER_URL_EXTRA = "org.trustroots.android.test.PROFILE_BROWSER_URL"
    }
}
