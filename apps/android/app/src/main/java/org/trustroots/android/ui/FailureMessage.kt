package org.trustroots.android.ui

internal fun Throwable.messageOr(fallback: String): String = message ?: fallback
