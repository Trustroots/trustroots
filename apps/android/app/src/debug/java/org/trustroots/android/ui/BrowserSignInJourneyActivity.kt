package org.trustroots.android.ui

import org.trustroots.android.MainActivity

class BrowserSignInJourneyActivity : MainActivity() {
    override val apiBaseUrl: String get() = intent.requireJourneyApiBaseUrl()
}
