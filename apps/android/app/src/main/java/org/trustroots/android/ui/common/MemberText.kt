package org.trustroots.android.ui.common

/** Keep supplied display text intact, while omitting absent or blank fields. */
internal fun nonBlankMemberText(value: String?): String? = value?.takeIf(String::isNotBlank)
