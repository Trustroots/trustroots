package org.trustroots.android.ui.common

import java.util.Locale

internal fun languageName(code: String): String {
    val names = mapOf(
        "eng" to "English", "ger" to "German", "deu" to "German", "fre" to "French",
        "fra" to "French", "spa" to "Spanish", "por" to "Portuguese", "ita" to "Italian",
        "dut" to "Dutch", "nld" to "Dutch", "rus" to "Russian", "cat" to "Catalan",
        "gsw" to "Swiss German", "swe" to "Swedish", "nor" to "Norwegian", "dan" to "Danish",
        "fin" to "Finnish", "pol" to "Polish", "ces" to "Czech", "cze" to "Czech",
        "ukr" to "Ukrainian", "tur" to "Turkish", "ara" to "Arabic", "rum" to "Romanian",
        "ron" to "Romanian", "jpn" to "Japanese", "kor" to "Korean", "zho" to "Chinese",
        "chi" to "Chinese", "hin" to "Hindi", "heb" to "Hebrew", "ell" to "Greek",
        "gre" to "Greek",
    )
    val normalised = code.lowercase(Locale.ROOT)
    val display = Locale.forLanguageTag(normalised).getDisplayLanguage(Locale.ENGLISH)
    return names[normalised] ?: display.takeIf { it.isNotBlank() && !it.equals(normalised, true) }
        ?: code.uppercase(Locale.ROOT)
}
