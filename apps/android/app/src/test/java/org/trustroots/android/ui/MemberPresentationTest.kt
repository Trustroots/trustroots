package org.trustroots.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MemberPresentationTest {
    @Test fun namesCommonProfileLanguages() {
        assertEquals("English", languageName("eng"))
        assertEquals("Portuguese", languageName("por"))
    }

    @Test fun showsRelativeMessageTime() {
        assertEquals("Just now", messageTime(1_000, 1_030))
        assertEquals("3 min ago", messageTime(1_000, 1_000 + 3 * 60_000))
    }

    @Test fun formatsMessageTimeAcrossHourDayAndLongDateBoundaries() {
        val now = 10_000_000_000L
        val minute = 60_000L
        val hour = 60 * minute
        val day = 24 * hour

        assertEquals("59 min ago", messageTime(now - (hour - 1), now))
        assertEquals("1 hr ago", messageTime(now - hour, now))
        assertEquals("23 hr ago", messageTime(now - (day - 1), now))
        assertEquals("1 days ago", messageTime(now - day, now))
        assertEquals("6 days ago", messageTime(now - (7 * day - 1), now))

        val longDate = messageTime(now - 7 * day, now)
        assertTrue(
            "Messages at least a week old should use the stable date-time format",
            Regex("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}").matches(longDate),
        )
    }
}
