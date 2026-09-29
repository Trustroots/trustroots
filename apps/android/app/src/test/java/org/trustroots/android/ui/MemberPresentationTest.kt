package org.trustroots.android.ui

import org.junit.Assert.assertEquals
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
}
