package org.trustroots.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.junit.Test
import java.util.Locale
import org.trustroots.android.ui.common.languageName
import org.trustroots.android.ui.common.languageCatalogue
import org.trustroots.android.ui.common.messageTime

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "en")
class MemberPresentationTest {
    private val resources = RuntimeEnvironment.getApplication().resources
    @Test fun namesCommonProfileLanguages() {
        assertEquals("English", languageName("eng"))
        assertEquals("Portuguese", languageName("por"))
    }

    @Test fun resolvesIsoPrefixedLanguageCodesIncludingMandinka() {
        val catalogue = languageCatalogue(RuntimeEnvironment.getApplication())
        assertEquals("Mandinka", languageName("iso_639_3-mnk", Locale.ENGLISH, catalogue))
        assertEquals("Mandinka", languageName("mnk", Locale.ENGLISH, catalogue))
        assertEquals("English", languageName("iso_639_3-eng", Locale.ENGLISH, catalogue))
        assertEquals("Portuguese", languageName("pt-BR", Locale.ENGLISH))
    }

    @Test fun resolvesRareIso6393LanguagesFromTheBundledCatalogue() {
        val catalogue = languageCatalogue(RuntimeEnvironment.getApplication())
        assertEquals("Ghotuo", languageName("iso_639_3-aaa", Locale.ENGLISH, catalogue))
        assertEquals("Alumu-Tesu", languageName("aab", Locale.ENGLISH, catalogue))
        val iso6393Entries = catalogue.filterKeys { it.startsWith("iso_639_3-") }
        assertTrue(catalogue.size > 7_000)
        assertTrue(iso6393Entries.values.all { it.isNotBlank() })
        iso6393Entries.forEach { (key, _) ->
            val code = key.removePrefix("iso_639_3-")
            val resolved = languageName(code, Locale.ENGLISH, catalogue)
            assertTrue("$code should resolve to a language name, got $resolved", resolved.isNotBlank())
            assertTrue(
                "$code should resolve to its catalogue name or a localised name, got $resolved",
                resolved.equals(catalogue.getValue(key), true) || !resolved.equals(code, true),
            )
        }
    }

    @Test fun canonicalisesLegacyLanguageAliasesForEnglishDisplay() {
        assertEquals("German", languageName("ger", Locale.ENGLISH))
        assertEquals("German", languageName("deu", Locale.ENGLISH))
        assertEquals("French", languageName("fre", Locale.ENGLISH))
        assertEquals("French", languageName("fra", Locale.ENGLISH))
        assertEquals("Dutch", languageName("dut", Locale.ENGLISH))
        assertEquals("Dutch", languageName("nld", Locale.ENGLISH))
    }

    @Test fun usesRequestedLocaleForLanguageDisplayAndKeepsUnknownFallback() {
        assertEquals("allemand", languageName("ger", Locale.FRENCH))
        assertEquals("alemão", languageName("ger", Locale("pt")))
        assertEquals("ZZX", languageName("zzx", Locale.FRENCH))
    }

    @Test fun showsRelativeMessageTime() {
        assertEquals("Just now", messageTime(resources, 1_000, 1_030))
        assertEquals("3 min ago", messageTime(resources, 1_000, 1_000 + 3 * 60_000))
    }

    @Test fun formatsMessageTimeAcrossHourDayAndLongDateBoundaries() {
        val now = 10_000_000_000L
        val minute = 60_000L
        val hour = 60 * minute
        val day = 24 * hour

        assertEquals("59 min ago", messageTime(resources, now - (hour - 1), now))
        assertEquals("1 hr ago", messageTime(resources, now - hour, now))
        assertEquals("23 hr ago", messageTime(resources, now - (day - 1), now))
        assertEquals("1 day ago", messageTime(resources, now - day, now))
        assertEquals("6 days ago", messageTime(resources, now - (7 * day - 1), now))

        val longDate = messageTime(resources, now - 7 * day, now)
        assertTrue(
            "Messages at least a week old should use the stable date-time format",
            Regex("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}").matches(longDate),
        )
    }
}
