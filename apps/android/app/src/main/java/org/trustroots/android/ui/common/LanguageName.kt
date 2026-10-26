package org.trustroots.android.ui.common

import android.content.Context
import org.json.JSONObject
import java.io.InputStreamReader
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
    return languageName(code, displayLocale, emptyMap())
}

internal fun languageName(context: Context, code: String, displayLocale: Locale = Locale.getDefault()): String {
    return languageName(code, displayLocale, languageCatalogue(context))
}

internal fun languageName(code: String, displayLocale: Locale, catalogue: Map<String, String>): String {
    val lowerCode = code.lowercase(Locale.ROOT)
    val normalised = when {
        lowerCode.startsWith("iso_639_3-") -> lowerCode.removePrefix("iso_639_3-")
        lowerCode.startsWith("iso_639_1-") -> lowerCode.removePrefix("iso_639_1-")
        else -> lowerCode
    }
    val catalogueName = catalogue["iso_639_3-$normalised"] ?: catalogue[normalised]
    if (normalised == "mnk" && catalogueName != null) return catalogueName
    val languageTag = legacyLanguageTags[normalised] ?: iso6393LanguageTags[normalised] ?: normalised
    val display = Locale.forLanguageTag(languageTag).getDisplayLanguage(displayLocale)
    return display.takeIf {
        it.isNotBlank() && !it.equals(languageTag, true) && !it.equals(normalised, true)
    }
        ?: catalogueName
        ?: code.uppercase(Locale.ROOT)
}

private object LanguageCatalogueCache {
    @Volatile private var names: Map<String, String>? = null

    fun get(context: Context): Map<String, String> = names ?: synchronized(this) {
        names ?: context.applicationContext.assets.open("languages.json").use { stream ->
            InputStreamReader(stream, Charsets.UTF_8).use { reader ->
                val json = JSONObject(reader.readText())
                buildMap(json.length()) {
                    val keys = json.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        put(key, json.getString(key))
                    }
                }
            }
        }.also { names = it }
    }
}

internal fun languageCatalogue(context: Context): Map<String, String> = LanguageCatalogueCache.get(context)
