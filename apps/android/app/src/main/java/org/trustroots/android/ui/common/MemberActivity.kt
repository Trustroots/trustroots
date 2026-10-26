package org.trustroots.android.ui.common

import android.content.Context
import android.text.format.DateUtils
import org.trustroots.android.R

internal fun memberLastActiveLabel(
    context: Context,
    lastActiveAtMillis: Long?,
    nowMillis: Long = System.currentTimeMillis(),
): String? {
    val timestamp = lastActiveAtMillis ?: return null
    if (timestamp > nowMillis) return context.getString(R.string.profile_activity_recently)
    return DateUtils.getRelativeTimeSpanString(
        timestamp,
        nowMillis,
        DateUtils.MINUTE_IN_MILLIS,
    ).toString()
}
