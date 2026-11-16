package org.trustroots.android.notifications

import org.json.JSONObject

internal fun senderIdFromPushPayload(payload: String): String? = runCatching {
    JSONObject(payload).getString("senderId")
}.getOrNull()?.takeIf { it.matches(Regex("[a-fA-F0-9]{24}")) }

internal fun isTestPushPayload(payload: String): Boolean = runCatching {
    JSONObject(payload).opt("test") == true
}.getOrDefault(false)
