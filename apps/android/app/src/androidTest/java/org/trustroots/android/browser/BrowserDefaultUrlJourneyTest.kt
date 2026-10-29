package org.trustroots.android.browser

import android.content.Context
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrowserDefaultUrlJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()

    @Test fun missingUrlExtraLoadsBlankPageAndBackClosesTheBrowserRoute() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val scenario = ActivityScenario.launch<BrowserHistoryJourneyActivity>(
            Intent(context, BrowserHistoryJourneyActivity::class.java),
        )
        try {
            compose.waitUntil("The browser should load its default blank URL", 10_000) {
                var loaded = false
                scenario.onActivity { activity ->
                    findWebView(activity.window.decorView)?.let { webView ->
                        loaded = webView.url == "about:blank" && !webView.canGoBack()
                    }
                }
                loaded
            }

            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            compose.onNodeWithText("Browser route closed").assertExists()
        } finally {
            scenario.close()
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findWebView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }
}
