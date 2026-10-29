package org.trustroots.android.ui.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MemberTextTest {
    @Test fun optionalTextOmitsNullEmptyAndWhitespaceOnlyValues() {
        listOf(null, "", " \n\t", "\u00a0").forEach { assertNull(nonBlankMemberText(it)) }
    }

    @Test fun meaningfulTextKeepsItsOriginalSpacingAndCase() {
        assertEquals("  Quiet Heron  ", nonBlankMemberText("  Quiet Heron  "))
    }
}
