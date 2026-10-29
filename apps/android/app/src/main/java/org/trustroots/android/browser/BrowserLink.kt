package org.trustroots.android.browser

import java.net.URI

/** Keeps a navigable HTTPS URL paired with the host shown in its confirmation. */
internal class BrowserLink private constructor(val url: String, val host: String) {
    val canEmbed: Boolean
        get() {
            val lowerHost = host.lowercase()
            return lowerHost == "trustroots.org" || lowerHost.endsWith(".trustroots.org") ||
                lowerHost == "hitchwiki.org" || lowerHost.endsWith(".hitchwiki.org")
        }

    companion object {
        fun parse(url: String): BrowserLink? = runCatching {
            val uri = URI(url)
            // The single-string URI parser returns null for an empty or invalid server host.
            val host = uri.host ?: return@runCatching null
            if (uri.scheme.equals("https", ignoreCase = true)) BrowserLink(url, host) else null
        }.getOrNull()
    }
}
