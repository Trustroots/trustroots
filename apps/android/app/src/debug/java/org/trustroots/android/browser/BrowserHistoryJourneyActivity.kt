package org.trustroots.android.browser

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import org.trustroots.android.ui.theme.TrustrootsTheme

class BrowserHistoryJourneyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra(URL_EXTRA) ?: "about:blank"
        setContent {
            TrustrootsTheme {
                var closed by remember { mutableStateOf(false) }
                if (closed) Text("Browser route closed") else {
                    TrustrootsBrowser(BrowserRoute("Local help", url), { closed = true }, PaddingValues.Zero)
                }
            }
        }
    }

    companion object {
        const val URL_EXTRA = "org.trustroots.android.test.BROWSER_URL"
    }
}
