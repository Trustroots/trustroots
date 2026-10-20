package org.trustroots.android.ui.common

internal fun Throwable.messageOr(fallback: String): String = message ?: fallback
