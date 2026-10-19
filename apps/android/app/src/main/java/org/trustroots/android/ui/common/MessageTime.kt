package org.trustroots.android.ui.common

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal fun messageTime(createdAt: Long, now: Long = System.currentTimeMillis()): String {
    val elapsed = (now - createdAt).coerceAtLeast(0)
    val minute = 60_000L
    val hour = 60 * minute
    val day = 24 * hour
    return when {
        elapsed < minute -> "Just now"
        elapsed < hour -> "${elapsed / minute} min ago"
        elapsed < day -> "${elapsed / hour} hr ago"
        elapsed < 7 * day -> "${elapsed / day} days ago"
        else -> SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT).format(Date(createdAt))
    }
}
