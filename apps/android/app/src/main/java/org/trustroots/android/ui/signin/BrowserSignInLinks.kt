package org.trustroots.android.ui.signin

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.trustroots.android.api.BrowserSignInCallback

internal class BrowserSignInLinks : ViewModel() {
    private val mutableCallback = MutableStateFlow<BrowserSignInCallback?>(null)
    val callback = mutableCallback.asStateFlow()
    private var lastCallbackURL: String? = null

    fun capture(intent: Intent): Boolean {
        if (intent.action != Intent.ACTION_VIEW) return false
        val url = intent.dataString ?: return false
        if (url == lastCallbackURL) return true
        val callback = BrowserSignInCallback.parse(url) ?: return false
        lastCallbackURL = url
        mutableCallback.value = callback
        return true
    }

    fun consume(callback: BrowserSignInCallback, handle: (BrowserSignInCallback) -> Unit) {
        if (mutableCallback.compareAndSet(callback, null)) handle(callback)
    }
}

internal fun launchSystemBrowser(context: Context, url: String): Boolean {
    return try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
        true
    } catch (_: ActivityNotFoundException) {
        false
    }
}
