package org.trustroots.android.ui.common

import java.util.Locale

private val legacyLanguageTags = mapOf(
    "ger" to "de", "fre" to "fr", "dut" to "nl", "cze" to "cs", "rum" to "ro",
    "chi" to "zh", "gre" to "el", "alb" to "sq", "arm" to "hy", "baq" to "eu",
    "bur" to "my", "geo" to "ka", "ice" to "is", "mac" to "mk", "mao" to "mi",
    "may" to "ms", "per" to "fa", "slo" to "sk", "tib" to "bo", "wel" to "cy",
)

private val iso6393LanguageTags by lazy {
    Locale.getISOLanguages().mapNotNull { languageTag ->
        val iso2Locale = Locale.forLanguageTag(languageTag)
        runCatching { iso2Locale.isO3Language.lowercase(Locale.ROOT) to languageTag }
            .getOrNull()
    }.toMap()
}

internal fun languageName(code: String, displayLocale: Locale = Locale.getDefault()): String {
    val normalised = code.lowercase(Locale.ROOT)
    val languageTag = legacyLanguageTags[normalised] ?: iso6393LanguageTags[normalised] ?: normalised
    val display = Locale.forLanguageTag(languageTag).getDisplayLanguage(displayLocale)
    return display.takeIf { it.isNotBlank() && !it.equals(languageTag, true) }
        ?: code.uppercase(Locale.ROOT)
}
