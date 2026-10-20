package org.trustroots.android.ui.common

import android.content.res.Resources
import org.trustroots.android.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal fun messageTime(
    resources: Resources,
    createdAt: Long,
    now: Long = System.currentTimeMillis(),
): String {
    val elapsed = (now - createdAt).coerceAtLeast(0)
    val minute = 60_000L
    val hour = 60 * minute
    val day = 24 * hour
    return when {
        elapsed < minute -> resources.getString(R.string.message_time_just_now)
        elapsed < hour -> resources.getQuantityString(R.plurals.message_time_minutes_ago, (elapsed / minute).toInt(), elapsed / minute)
        elapsed < day -> resources.getQuantityString(R.plurals.message_time_hours_ago, (elapsed / hour).toInt(), elapsed / hour)
        elapsed < 7 * day -> resources.getQuantityString(R.plurals.message_time_days_ago, (elapsed / day).toInt(), elapsed / day)
        else -> SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(createdAt))
    }
}
