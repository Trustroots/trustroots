package org.trustroots.android.api

import android.content.Context

internal class MessageDraftStore(context: Context) {
    private val preferences = context.applicationContext
        .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun load(selfUsername: String, otherKey: String): String =
        preferences.getString(cacheKey(selfUsername, otherKey), "").orEmpty()

    fun save(selfUsername: String, otherKey: String, text: String) {
        val key = cacheKey(selfUsername, otherKey)
        if (text.isBlank()) {
            preferences.edit().remove(key).apply()
        } else {
            preferences.edit().putString(key, text).apply()
        }
    }

    fun clear(selfUsername: String, otherKey: String) {
        preferences.edit().remove(cacheKey(selfUsername, otherKey)).apply()
    }

    companion object {
        private const val PREFERENCES_NAME = "message_drafts"

        internal fun cacheKey(selfUsername: String, otherKey: String): String =
            "messages.thread.$selfUsername-$otherKey"
    }
}
