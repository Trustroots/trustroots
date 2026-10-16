package org.trustroots.android.ui

import org.trustroots.android.api.MobileApiException

internal fun Throwable.isAuthenticationFailure(): Boolean {
    val apiError = this as? MobileApiException ?: return false
    return apiError.isAuthenticationFailure
}
