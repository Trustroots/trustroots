package org.trustroots.android.ui.signin

import android.content.Context

// Debug installs use test signing and do not share the release app’s verified association.
internal fun openBrowserSignIn(context: Context, url: String): Boolean = launchSystemBrowser(context, url)
