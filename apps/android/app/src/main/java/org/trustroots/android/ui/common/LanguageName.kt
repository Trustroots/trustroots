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
    buildIso6393LanguageTags(
        Locale.getISOLanguages().asIterable(),
        iso3Language = { it.isO3Language },
    )
}

internal fun buildIso6393LanguageTags(
    languageTags: Iterable<String>,
    iso3Language: (Locale) -> String,
): Map<String, String> = languageTags.mapNotNull { languageTag ->
    val iso2Locale = Locale.forLanguageTag(languageTag)
    runCatching { iso3Language(iso2Locale).lowercase(Locale.ROOT) to languageTag }
        .getOrNull()
}.toMap()

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
    return languageDisplayName(display, languageTag, normalised, catalogueName, code)
}

internal fun languageDisplayName(
    display: String,
    languageTag: String,
    normalised: String,
    catalogueName: String?,
    originalCode: String,
): String = display.takeIf {
    it.isNotBlank() && !it.equals(languageTag, true) && !it.equals(normalised, true)
}
    ?: catalogueName
    ?: originalCode.uppercase(Locale.ROOT)

internal class LanguageCatalogueCache {
    @Volatile private var names: Map<String, String>? = null

    fun get(loader: () -> Map<String, String>): Map<String, String> = names ?: synchronized(this) {
        names ?: loader().also { names = it }
    }
}

private val languageCatalogueCache = LanguageCatalogueCache()

internal fun languageCatalogue(context: Context): Map<String, String> =
    languageCatalogueCache.get {
        context.applicationContext.assets.open("languages.json").use { stream ->
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
        }
    }
