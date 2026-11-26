package org.trustroots.android.ui.signin

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.verify.domain.DomainVerificationManager
import android.content.pm.verify.domain.DomainVerificationUserState
import android.net.Uri
import android.os.Build
import org.trustroots.android.api.BROWSER_SIGN_IN_CALLBACK_HOST
import org.trustroots.android.api.BROWSER_SIGN_IN_CALLBACK_URL

internal fun openBrowserSignIn(context: Context, url: String): Boolean {
    val authorization = Uri.parse(url)
    if (
        authorization.scheme != "https" ||
        authorization.encodedAuthority != BROWSER_SIGN_IN_CALLBACK_HOST ||
        authorization.encodedPath != "/auth/mobile/start"
    ) return false
    return canReceiveBrowserSignInCallback(context) && launchSystemBrowser(context, url)
}

private fun canReceiveBrowserSignInCallback(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val state = try {
            context.getSystemService(DomainVerificationManager::class.java)
                ?.getDomainVerificationUserState(context.packageName)
        } catch (_: PackageManager.NameNotFoundException) {
            null
        }
        return state?.isLinkHandlingAllowed == true &&
            state.hostToStateMap[BROWSER_SIGN_IN_CALLBACK_HOST] == DomainVerificationUserState.DOMAIN_STATE_VERIFIED
    }
    // Older versions do not expose verification state. Require our app to be the chosen handler.
    val callback = Intent(
        Intent.ACTION_VIEW,
        Uri.parse(BROWSER_SIGN_IN_CALLBACK_URL),
    ).addCategory(Intent.CATEGORY_BROWSABLE)
    val handler = context.packageManager.resolveActivity(callback, PackageManager.MATCH_DEFAULT_ONLY)
    return handler?.activityInfo?.packageName == context.packageName
}
